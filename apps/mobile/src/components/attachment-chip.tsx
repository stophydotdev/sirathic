import { type FileKind, kindOf } from "@sirathic/server/files";
import type { ChatMessage } from "@sirathic/server/messages";
import type { FC } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSignedUri } from "@/lib/auth";
import { File, FileText, Photo, X } from "./icons";

const KIND_ICONS = { image: Photo, pdf: File, text: FileText } satisfies Record<
  FileKind,
  typeof File
>;

const FileKindIcon: FC<{ mediaType: string; size?: number }> = ({ mediaType, size = 20 }) => {
  const Icon = KIND_ICONS[kindOf(mediaType)];
  return <Icon size={size} strokeWidth={1.75} colorClassName="accent-muted-foreground" />;
};

export const AttachmentChip: FC<{
  name: string;
  mediaType: string;
  uri: string;
  onRemove?: () => void;
}> = ({ name, mediaType, uri, onRemove }) => {
  const shown = useSignedUri(uri);
  return (
    <View className="border-border bg-muted max-w-64 flex-row items-center gap-3 rounded-xl border py-2 ps-2 pe-3">
      <View className="bg-background size-10 items-center justify-center overflow-hidden rounded-lg">
        {kindOf(mediaType) === "image" && shown ? (
          <Image source={{ uri: shown }} className="size-10" />
        ) : (
          <FileKindIcon mediaType={mediaType} />
        )}
      </View>
      <Text numberOfLines={1} className="text-foreground font-sans shrink text-sm">
        {name}
      </Text>
      {onRemove && (
        <Pressable
          accessibilityLabel="Remove"
          onPress={onRemove}
          className="bg-card border-border absolute -end-1.5 -top-1.5 size-6 items-center justify-center rounded-full border"
        >
          <X size={14} strokeWidth={2} colorClassName="accent-muted-foreground" />
        </Pressable>
      )}
    </View>
  );
};

export const SentFiles: FC<{ message: ChatMessage }> = ({ message }) => {
  const files = message.parts.flatMap((part) => (part.type === "file" ? [part] : []));
  if (files.length === 0) return null;
  return (
    <View className="mb-2 flex-row flex-wrap justify-end gap-2">
      {files.map((file) => (
        <AttachmentChip
          key={file.url}
          name={file.filename ?? "File"}
          mediaType={file.mediaType}
          uri={file.url}
        />
      ))}
    </View>
  );
};
