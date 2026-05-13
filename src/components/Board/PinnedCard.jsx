import PostCard from './PostCard'

// 단순히 PostCard에 pinned 플래그 전달하는 래퍼
export default function PinnedCard(props) {
  return <PostCard {...props} pinned />
}
