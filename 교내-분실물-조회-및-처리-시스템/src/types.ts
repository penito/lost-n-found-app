export interface User {
  id: string; // User-selected login ID
  name: string; // Real Name
  studentId: string; // Student ID
  email: string; // Email address
  password?: string; // Kept simple for the student prototype and comparison
  isAdmin?: boolean; // 관리자 권한 여부
  avatarEmoji?: string; // 프로필 아바타 이모지
  profileColor?: string; // 프로필 배경/테마 색상 (예: indigo, rose, emerald, amber, violet, sky)
  bio?: string; // 프로필 상태 메시지/자기소개
}

export type PostType = 'found' | 'lost'; // 습득물 | 분실물

export interface Post {
  id: string;
  title: string;
  type: PostType;
  reporterName: string; // 발견자 or 분실자 이름
  reporterStudentId: string; // 발견자 or 분실자 학번
  location: string; // 발견/분실 위치
  tags: string[]; // Selected search tags
  description: string; // Detailed description
  createdAt: string; // ISO Date String
  views: number; // View count
  resolved: boolean; // 해결 여부 (수령완료/찾음 등)
  authorId: string; // Writer's login ID (for managing own posts)
  imageUrl?: string; // 첨부된 이미지 (Base64 형식)
  // Enriched author properties for UI rendering
  authorAvatarEmoji?: string;
  authorProfileColor?: string;
  authorBio?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorStudentId: string;
  content: string;
  createdAt: string;
  // Enriched author properties for UI rendering
  authorAvatarEmoji?: string;
  authorProfileColor?: string;
  authorBio?: string;
}

export interface Report {
  id: string;
  targetId: string;
  targetType: 'post' | 'comment';
  targetTitleOrContent: string;
  reason: string;
  customReason?: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  resolved: boolean;
}

export const CATEGORY_TAGS = [
  '전자기기',
  '필기구',
  '의류',
  '가방',
  '지갑',
  '학생증',
  '교과서',
  '체육용품',
  '악세서리',
  '기타'
] as const;

export type CategoryTag = typeof CATEGORY_TAGS[number];
