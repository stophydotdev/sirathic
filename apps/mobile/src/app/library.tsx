import { formatSize, kindOf } from "@sirathic/server/files";
import { type FC, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Books } from "@/components/icons";
import { EmptyBox, Page, Row, Tabs } from "@/components/page";
import { api } from "@/lib/api";
import { API_URL, authClient, useSignedUri } from "@/lib/auth";

type File = Awaited<ReturnType<typeof api.files.list.query>>[number];

const TABS = [
  ["all", "All"],
  ["media", "Media"],
  ["files", "Files"],
] as const;

type Tab = (typeof TABS)[number][0];

const shows = (tab: Tab, file: File) =>
  tab === "all" || (tab === "media") === (kindOf(file.mediaType) === "image");

const Thumb: FC<{ id: string }> = ({ id }) => {
  const uri = useSignedUri(`${API_URL}/api/files/${id}`);
  return uri ? (
    <Image source={{ uri }} className="size-10" />
  ) : (
    <Books size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
  );
};

export default function Library() {
  const signedIn = authClient.useSession().data !== null;
  const [files, setFiles] = useState<File[]>();
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (!signedIn) return;
    void api.files.list.query().then(setFiles, () => setFiles([]));
  }, [signedIn]);

  const shown = files?.filter((file) => shows(tab, file)) ?? [];

  return (
    <Page title="Library">
      <Tabs tabs={TABS} tab={tab} onChange={setTab} />
      {!signedIn ? (
        <EmptyBox
          title="Sign in to use your library."
          hint="Upload images, PDFs or UTF-8 text files up to 10 MB each."
          signIn
        />
      ) : files && shown.length === 0 ? (
        <EmptyBox
          title="Upload files to keep them within reach."
          hint="Upload images, PDFs or UTF-8 text files up to 10 MB each."
        />
      ) : (
        shown.map((file) => (
          <Row key={file.id}>
            <View className="bg-muted size-10 items-center justify-center overflow-hidden rounded-lg">
              {kindOf(file.mediaType) === "image" ? (
                <Thumb id={file.id} />
              ) : (
                <Books size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
              )}
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-foreground font-sans text-sm">
                {file.name}
              </Text>
              <Text className="text-muted-foreground font-sans text-xs">
                {`${new Date(file.createdAt).toLocaleDateString()} · ${formatSize(file.size)}`}
              </Text>
            </View>
          </Row>
        ))
      )}
    </Page>
  );
}
