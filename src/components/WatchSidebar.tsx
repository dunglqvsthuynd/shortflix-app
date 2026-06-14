import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, MessageSquare, Bookmark, Share2, List } from "lucide-react-native";
import { useT } from "../i18n";

interface Props {
  liked: boolean;
  favorited: boolean;
  likeCount: string;
  onLike: () => void;
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
  liked,
  favorited,
  likeCount,
  onLike,
  onFavorite,
  onShare,
  onEpisodes,
}: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View className="absolute right-3 items-center" style={{ bottom: insets.bottom + 96 }}>
      <Item
        icon={<Heart size={24} color={liked ? "#E50914" : "#fff"} fill={liked ? "#E50914" : "transparent"} />}
        label={likeCount}
        onPress={onLike}
      />
      <Item icon={<MessageSquare size={22} color="#fff" />} label="842" onPress={() => {}} />
      <Item
        icon={<Bookmark size={22} color={favorited ? "#E50914" : "#fff"} fill={favorited ? "#E50914" : "transparent"} />}
        label="2.1K"
        onPress={onFavorite}
      />
      <Item icon={<Share2 size={22} color="#fff" />} label={t("watch.share")} onPress={onShare} />
      <Item icon={<List size={22} color="#E50914" />} label={t("watch.episodes")} onPress={onEpisodes} />
    </View>
  );
}
