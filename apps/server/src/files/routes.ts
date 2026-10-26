import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { userFor } from "../auth";
import { respond, StatusError } from "../respond";
import { FILE_NAME_MAX, MAX_FILE_BYTES } from "../shared/files";
import { mediaTypeOf } from "./sniff";
import { storage } from "./storage";
import { fileId, fileOf, saveFile } from "./store";

const FORM_OVERHEAD_BYTES = 100 * 1024;

const upload = z.object({
  file: z.instanceof(File),
  projectId: z.uuid().optional(),
});

export const filesRoutes = new Hono();

const tooLarge = bodyLimit({
  maxSize: MAX_FILE_BYTES + FORM_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: "That file is too large." }, 400),
});

filesRoutes.post("/", tooLarge, (c) =>
  respond(async () => {
    const user = await userFor(c.req.raw.headers);
    if (!user) throw new StatusError(401, "not signed in");
    const form = await c.req.raw.formData().catch(() => undefined);
    const parsed = upload.safeParse({
      file: form?.get("file"),
      projectId: form?.get("projectId") || undefined,
    });
    if (!parsed.success) throw new StatusError(400, z.prettifyError(parsed.error));
    const { file, projectId } = parsed.data;
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      throw new StatusError(400, "That file is empty or too large.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = mediaTypeOf(bytes);
    if (!mediaType)
      throw new StatusError(400, "Only images, PDFs and UTF-8 text files can be uploaded.");
    return saveFile(user.id, {
      name: file.name.trim().slice(-FILE_NAME_MAX) || "file",
      mediaType,
      bytes,
      projectId,
    });
  }),
);

filesRoutes.get("/:id", (c) =>
  respond(async () => {
    const user = await userFor(c.req.raw.headers);
    if (!user) throw new StatusError(401, "not signed in");
    const id = fileId.safeParse(c.req.param("id"));
    const file = id.success ? await fileOf(id.data, user.id) : undefined;
    if (!file) throw new StatusError(404, "no such file");
    return new Response(await storage.bytes(file.key), {
      headers: {
        "Content-Type": file.mediaType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),
);
