import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, MessageSquare, Bookmark, Share2, List, Plus, Check } from "lucide-react-native";
import { useT } from "../i18n";

interface Props {
  avatar: string;
  following: boolean;
  liked: boolean;
  favorited: boolean;
  likeCount: string;
  commentCount: string;
  saveCount: string;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onFavorite: () => void;
  onShare: () => void;
  onEpisodes: () => void;
}

function Item({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="items-center mb-5">
      <View className="w-11 h-11 rounded-full bg-black/40 border border-white/5 items-center justify-center mb-1">
        {icon}
      </View>
      <Text className="text-white text-[10px] font-sans-bold">{label}</Text>
    </Pressable>
  );
}

export default function WatchSidebar({
  avatar,
  following,
  liked,
  favorited,
  likeCount,
  commentCount,
  saveCount,
  onFollow,
  onLike,
  onComment,
  onFavorite,
  onShare,
  onEpisodes,
}: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View className="absolute right-3 items-center" style={{ bottom: insets.bottom + 96 }}>
      {/* Creator/series avatar with follow toggle (TikTok-style). */}
      <Pressable onPress={onFollow} className="items-center mb-6">
        <Image
          source={avatar}
          style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: "#fff" }}
        />
        <View
          className={`absolute -bottom-2 w-5 h-5 rounded-full items-center justify-center ${
            following ? "bg-white" : "bg-brand"
          }`}
        >
          {following ? <Check size={12} color="#111" /> : <Plus size={12} color="#fff" />}
        </View>
      </Pressable>

      <Item
        icon={<Heart size={24} color={liked ? "#E50914" : "#fff"} fill={liked ? "#E50914" : "transparent"} />}
        label={likeCount}
        onPress={onLike}
      />
      <Item icon={<MessageSquare size={22} color="#fff" />} label={commentCount} onPress={onComment} />
      <Item
        icon={<Bookmark size={22} color={favorited ? "#E50914" : "#fff"} fill={favorited ? "#E50914" : "transparent"} />}
        label={saveCount}
        onPress={onFavorite}
      />
      <Item icon={<Share2 size={22} color="#fff" />} label={t("watch.share")} onPress={onShare} />
      <Item icon={<List size={22} color="#E50914" />} label={t("watch.episodes")} onPress={onEpisodes} />
    </View>
  );
}
