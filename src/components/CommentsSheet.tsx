import { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Send, X } from "lucide-react-native";
import { Comment } from "../types";
import { timeAgo } from "../data/social";
import { formatCount } from "../data/catalog";
import { useT } from "../i18n";

interface Props {
  visible: boolean;
  comments: Comment[]; // merged (user + seed), newest first
  meAvatar: string;
  now: number;
  onClose: () => void;
  onSend: (text: string) => void;
}

function Row({ c, vi, now }: { c: Comment; vi: boolean; now: number }) {
  return (
    <View className="flex-row px-5 py-3">
      <Image source={c.avatarUrl} style={{ width: 36, height: 36, borderRadius: 18 }} />
      <View className="flex-1 ml-3">
        <Text className="text-ink/60 text-xs font-sans-bold">{c.author}</Text>
        <Text className="text-white text-sm mt-0.5 leading-snug">{c.text}</Text>
        <Text className="text-ink/40 text-[11px] mt-1">{timeAgo(c.createdAt, now, vi)}</Text>
      </View>
      <View className="items-center ml-2">
        <Heart size={15} color="#9aa0ad" />
        <Text className="text-ink/50 text-[10px] mt-0.5">{formatCount(c.likes)}</Text>
      </View>
    </View>
  );
}

export default function CommentsSheet({
  visible,
  comments,
  meAvatar,
  now,
  onClose,
  onSend,
}: Props) {
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const vi = lang === "vi";

  const header = useMemo(
    () => `${formatCount(comments.length)} ${t("watch.commentsTitle")}`,
    [comments.length, t]
  );

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        {/* Inner press stops the backdrop from closing when interacting with the sheet. */}
        <Pressable
          className="bg-surface rounded-t-2xl border-t border-white/5 h-[72%]"
          onPress={() => {}}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View className="w-12 h-1 bg-surface-line rounded-full self-center my-3" />
            <View className="flex-row items-center justify-between px-5 pb-3 border-b border-white/5">
              <Text className="text-white font-display text-sm">{header}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={20} color="#9aa0ad" />
              </Pressable>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => <Row c={item} vi={vi} now={now} />}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text className="text-ink/40 text-center mt-10">{t("watch.noComments")}</Text>
              }
            />

            {/* Composer */}
            <View
              className="flex-row items-center px-4 pt-2 border-t border-white/5"
              style={{ paddingBottom: insets.bottom + 8 }}
            >
              <Image source={meAvatar} style={{ width: 32, height: 32, borderRadius: 16 }} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t("watch.addComment")}
                placeholderTextColor="#6b7280"
                className="flex-1 mx-3 text-white text-sm bg-black/30 rounded-full px-4 py-2.5"
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              <Pressable onPress={submit} hitSlop={8} disabled={!text.trim()}>
                <Send size={22} color={text.trim() ? "#E50914" : "#6b7280"} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
