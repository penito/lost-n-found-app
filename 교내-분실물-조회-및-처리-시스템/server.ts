import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

// ES modules support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_FILE_PATH = path.join(process.cwd(), "data", "db.json");

// Define types in server to ensure complete consistency
interface User {
  id: string;
  name: string;
  studentId: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
  avatarEmoji?: string;
  profileColor?: string;
  bio?: string;
}

interface Post {
  id: string;
  title: string;
  type: 'found' | 'lost';
  reporterName: string;
  reporterStudentId: string;
  location: string;
  tags: string[];
  description: string;
  createdAt: string;
  views: number;
  resolved: boolean;
  authorId: string;
  imageUrl?: string;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorStudentId: string;
  content: string;
  createdAt: string;
}

interface Report {
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

interface DatabaseSchema {
  users: User[];
  posts: Post[];
  comments: Comment[];
  reports: Report[];
}

/**
 * Seed initial users if database is empty or not created yet
 */
const SEED_USERS: User[] = [
  {
    id: "admin",
    name: "관리자",
    studentId: "000000000",
    email: "admin@school.ac.kr",
    password: "1234",
    isAdmin: true,
  }
];

/**
 * Seed initial posts if database is empty
 */
const getInitialPosts = (): Post[] => [];

/**
 * Seed initial comments if database is empty
 */
const getInitialComments = (): Comment[] => [];

/**
 * Reads database schema securely from local file
 * @returns DatabaseSchema parsed object
 */
function readDB(): DatabaseSchema {
  try {
    const parentDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE_PATH)) {
      const initialSchema: DatabaseSchema = {
        users: SEED_USERS,
        posts: getInitialPosts(),
        comments: getInitialComments(),
        reports: []
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialSchema, null, 2), "utf8");
      return initialSchema;
    }

    const fileContent = fs.readFileSync(DB_FILE_PATH, "utf8");
    const parsed = JSON.parse(fileContent) as DatabaseSchema;

    // Safety fallback properties
    if (!parsed.users) parsed.users = SEED_USERS;
    if (!parsed.posts) parsed.posts = getInitialPosts();
    if (!parsed.comments) parsed.comments = getInitialComments();
    if (!parsed.reports) parsed.reports = [];

    // Ensure our mandatory admin user exists
    if (!parsed.users.some(u => u.id === "admin")) {
      parsed.users.unshift({
        id: "admin",
        name: "관리자",
        studentId: "000000000",
        email: "admin@school.ac.kr",
        password: "1234",
        isAdmin: true
      });
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(parsed, null, 2), "utf8");
    }

    return parsed;
  } catch (error) {
    console.error("Database reading error, resetting safely...", error);
    return {
      users: SEED_USERS,
      posts: getInitialPosts(),
      comments: getInitialComments(),
      reports: []
    };
  }
}

/**
 * Writes entire database schema to file storage securely
 * @param data DatabaseSchema object to save
 */
function writeDB(data: DatabaseSchema) {
  try {
    const parentDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Database writing error:", error);
  }
}

// Enable standard parsing middlewares with increased payload limit for image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- API Endpoints and Controllers ---

/**
 * 1. User Registration controller
 * POST /api/users/register
 */
app.post("/api/users/register", (req, res) => {
  const { id, name, studentId, email, password } = req.body;
  
  if (!id || !name || !studentId || !email || !password) {
    return res.status(400).json({ success: false, message: "필수 입력 항목이 누락되었습니다." });
  }

  const dbData = readDB();

  // Validate duplicate user ID
  if (dbData.users.some(u => u.id.toLowerCase() === id.toLowerCase())) {
    return res.status(400).json({ success: false, message: "이미 존재하는 아이디입니다." });
  }

  // Validate duplicate Student ID
  if (dbData.users.some(u => u.studentId === studentId)) {
    return res.status(400).json({ success: false, message: "이미 존재하는 학번입니다." });
  }

  // Validate duplicate email
  if (dbData.users.some(u => u.email === email)) {
    return res.status(400).json({ success: false, message: "이미 가입된 이메일 주소입니다." });
  }

  const newUser: User = {
    id,
    name,
    studentId,
    email,
    password,
    isAdmin: false
  };

  dbData.users.push(newUser);
  writeDB(dbData);

  res.json({ success: true, message: "회원가입이 성공적으로 완료되었습니다." });
});

/**
 * 2. User Login controller
 * POST /api/users/login
 */
app.post("/api/users/login", (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ success: false, message: "아이디와 비밀번호를 입력해주세요." });
  }

  const dbData = readDB();
  const user = dbData.users.find(u => u.id === id);

  if (!user) {
    return res.status(401).json({ success: false, message: "아이디가 존재하지 않습니다." });
  }

  if (user.password !== password) {
    return res.status(401).json({ success: false, message: "비밀번호가 일치하지 않습니다." });
  }

  // Retain only necessary session traits alongside profile custom traits
  const sessionUser: User = {
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    isAdmin: !!user.isAdmin,
    avatarEmoji: user.avatarEmoji,
    profileColor: user.profileColor,
    bio: user.bio
  };

  res.json({ success: true, user: sessionUser, message: "로그인 성공" });
});

/**
 * 3. Retrieve all users (ADMIN restricted)
 * GET /api/users
 */
app.get("/api/users", (req, res) => {
  const adminIdHeader = req.headers["x-admin-id"] as string;
  const dbData = readDB();
  const requester = dbData.users.find(u => u.id === adminIdHeader);

  if (!requester || !requester.isAdmin) {
    return res.status(403).json({ success: false, message: "사용자 목록을 조회할 권한이 없습니다." });
  }

  // Hide password fields before delivery
  const safeUsers = dbData.users.map(({ password, ...u }) => u);
  res.json({ success: true, users: safeUsers });
});

/**
 * 4. Delete user account (ADMIN restricted)
 * DELETE /api/users/:userId
 */
app.delete("/api/users/:userId", (req, res) => {
  const adminIdHeader = req.headers["x-admin-id"] as string;
  const targetUserId = req.params.userId;

  const dbData = readDB();
  const requester = dbData.users.find(u => u.id === adminIdHeader);

  if (!requester || !requester.isAdmin) {
    return res.status(403).json({ success: false, message: "사용자를 삭제할 권한이 없습니다." });
  }

  if (targetUserId === "op.dymic") {
    return res.status(400).json({ success: false, message: "마스터 관리자 계정은 삭제할 수 없습니다." });
  }

  const initialCount = dbData.users.length;
  dbData.users = dbData.users.filter(u => u.id !== targetUserId);

  if (dbData.users.length === initialCount) {
    return res.status(404).json({ success: false, message: "존재하지 않는 사용자입니다." });
  }

  // Cascade delete: delete posts authored by deleted user, or keep them?
  // Let's keep comments/posts or delete them. Typically cascading posts is clean
  dbData.posts = dbData.posts.filter(p => p.authorId !== targetUserId);
  dbData.comments = dbData.comments.filter(c => c.authorId !== targetUserId);

  writeDB(dbData);
  res.json({ success: true, message: "해당 사용자와 작성된 글/댓글이 모두 완전히 삭제되었습니다." });
});

/**
 * 5. Retrieve all posts
 * GET /api/posts
 */
app.get("/api/posts", (req, res) => {
  const dbData = readDB();
  // Return descending (newest first) with author profile decorations dynamically populated
  const enrichedPosts = dbData.posts.map(post => {
    const author = dbData.users.find(u => u.id === post.authorId);
    return {
      ...post,
      authorAvatarEmoji: author?.avatarEmoji,
      authorProfileColor: author?.profileColor,
      authorBio: author?.bio
    };
  });
  res.json({ success: true, posts: enrichedPosts });
});

/**
 * 6. Create post
 * POST /api/posts
 */
app.post("/api/posts", (req, res) => {
  const { title, type, reporterName, reporterStudentId, location, tags, description, authorId, imageUrl } = req.body;

  if (!title || !type || !reporterName || !reporterStudentId || !location || !tags || !description || !authorId) {
    return res.status(400).json({ success: false, message: "필수 정보가 누락되었습니다." });
  }

  const dbData = readDB();
  const newPost: Post = {
    id: `post-${Date.now()}`,
    title,
    type,
    reporterName,
    reporterStudentId,
    location,
    tags: Array.isArray(tags) ? tags : [tags],
    description,
    createdAt: new Date().toISOString(),
    views: 0,
    resolved: false,
    authorId,
    imageUrl: imageUrl || undefined
  };

  dbData.posts.unshift(newPost);
  writeDB(dbData);

  res.json({ success: true, post: newPost, message: "게시글이 성공적으로 등록되었습니다." });
});

/**
 * 7. Update post
 * PUT /api/posts/:postId
 */
app.put("/api/posts/:postId", (req, res) => {
  const postId = req.params.postId;
  const { requesterId, title, location, tags, description, resolved, imageUrl } = req.body;

  const dbData = readDB();
  const postIdx = dbData.posts.findIndex(p => p.id === postId);

  if (postIdx === -1) {
    return res.status(404).json({ success: false, message: "해당 게시글이 존재하지 않습니다." });
  }

  const post = dbData.posts[postIdx];
  const requester = dbData.users.find(u => u.id === requesterId);

  // Validate ownership OR admin status
  const isAuthorized = requester && (post.authorId === requesterId || requester.isAdmin);
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "변경 권한이 없습니다." });
  }

  // Merge changes carefully
  dbData.posts[postIdx] = {
    ...post,
    ...(title !== undefined && { title }),
    ...(location !== undefined && { location }),
    ...(tags !== undefined && { tags }),
    ...(description !== undefined && { description }),
    ...(resolved !== undefined && { resolved }),
    ...(imageUrl !== undefined && { imageUrl })
  };

  writeDB(dbData);
  res.json({ success: true, post: dbData.posts[postIdx], message: "게시글이 성공적으로 수정되었습니다." });
});

/**
 * 8. Delete post
 * DELETE /api/posts/:postId
 */
app.delete("/api/posts/:postId", (req, res) => {
  const postId = req.params.postId;
  const requesterId = req.headers["x-user-id"] as string;

  const dbData = readDB();
  const postIdx = dbData.posts.findIndex(p => p.id === postId);

  if (postIdx === -1) {
    return res.status(404).json({ success: false, message: "해당 게시글이 존재하지 않습니다." });
  }

  const post = dbData.posts[postIdx];
  const requester = dbData.users.find(u => u.id === requesterId);

  // Verify deletion authority (Admin OR Author)
  const isAuthorized = requester && (post.authorId === requesterId || requester.isAdmin);
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "해당 게시글을 삭제할 권한이 없습니다." });
  }

  // Remove the post from array
  dbData.posts.splice(postIdx, 1);
  
  // Clean up orphan comment associations
  dbData.comments = dbData.comments.filter(c => c.postId !== postId);

  writeDB(dbData);
  res.json({ success: true, message: "게시글이 무사히 삭제 처리되었습니다." });
});

/**
 * 9. View count incrementor api proxy
 * POST /api/posts/:postId/view
 */
app.post("/api/posts/:postId/view", (req, res) => {
  const postId = req.params.postId;
  
  const dbData = readDB();
  const postIdx = dbData.posts.findIndex(p => p.id === postId);

  if (postIdx !== -1) {
    dbData.posts[postIdx].views += 1;
    writeDB(dbData);
    return res.json({ success: true, views: dbData.posts[postIdx].views });
  }

  res.status(404).json({ success: false, message: "게시글 없음" });
});

/**
 * 10. Retrieve comments of specific post
 * GET /api/comments/:postId
 */
app.get("/api/comments/:postId", (req, res) => {
  const postId = req.params.postId;
  const dbData = readDB();
  
  const postComments = dbData.comments
    .filter(c => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // older comments first

  const enrichedComments = postComments.map(comment => {
    const author = dbData.users.find(u => u.id === comment.authorId);
    return {
      ...comment,
      authorAvatarEmoji: author?.avatarEmoji,
      authorProfileColor: author?.profileColor,
      authorBio: author?.bio
    };
  });

  res.json({ success: true, comments: enrichedComments });
});

/**
 * 11. Add a comment
 * POST /api/comments
 */
app.post("/api/comments", (req, res) => {
  const { postId, authorId, content } = req.body;

  if (!postId || !authorId || !content) {
    return res.status(400).json({ success: false, message: "댓글 항목이 누락되었습니다." });
  }

  const dbData = readDB();
  const author = dbData.users.find(u => u.id === authorId);

  if (!author) {
    return res.status(401).json({ success: false, message: "유효하지 않은 계정 정보입니다." });
  }

  const newComment: Comment = {
    id: `comment-${Date.now()}`,
    postId,
    authorId: author.id,
    authorName: author.name,
    authorStudentId: author.studentId,
    content,
    createdAt: new Date().toISOString()
  };

  dbData.comments.push(newComment);
  writeDB(dbData);

  res.json({ success: true, comment: newComment, message: "댓글이 정상적으로 등록되었습니다." });
});

/**
 * 12. Delete comment
 * DELETE /api/comments/:commentId
 */
app.delete("/api/comments/:commentId", (req, res) => {
  const commentId = req.params.commentId;
  const requesterId = req.headers["x-user-id"] as string;

  const dbData = readDB();
  const commentIdx = dbData.comments.findIndex(c => c.id === commentId);

  if (commentIdx === -1) {
    return res.status(404).json({ success: false, message: "해당 댓글이 존재하지 않습니다." });
  }

  const comment = dbData.comments[commentIdx];
  const relatedPost = dbData.posts.find(p => p.id === comment.postId);
  const requester = dbData.users.find(u => u.id === requesterId);

  // Authorized if comment author OR associated post author OR administrator
  const isAuthorized = requester && (
    comment.authorId === requesterId || 
    (relatedPost && relatedPost.authorId === requesterId) || 
    requester.isAdmin
  );

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "댓글 삭제 권한이 없습니다." });
  }

  dbData.comments.splice(commentIdx, 1);
  writeDB(dbData);

  res.json({ success: true, message: "댓글이 정상 제거되었습니다." });
});

/**
 * 13. Update User Profile Settings
 * PUT /api/users/profile
 */
app.put("/api/users/profile", (req, res) => {
  const { id, name, avatarEmoji, profileColor, bio } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "사용자 ID가 누락되었습니다." });
  }

  const dbData = readDB();
  const userIdx = dbData.users.findIndex(u => u.id === id);

  if (userIdx === -1) {
    return res.status(404).json({ success: false, message: "가입 정보를 찾을 수 없습니다." });
  }

  // Update specified fields safely
  dbData.users[userIdx] = {
    ...dbData.users[userIdx],
    ...(name !== undefined && { name }),
    ...(avatarEmoji !== undefined && { avatarEmoji }),
    ...(profileColor !== undefined && { profileColor }),
    ...(bio !== undefined && { bio })
  };

  writeDB(dbData);

  const updatedUser: User = {
    id: dbData.users[userIdx].id,
    name: dbData.users[userIdx].name,
    studentId: dbData.users[userIdx].studentId,
    email: dbData.users[userIdx].email,
    isAdmin: !!dbData.users[userIdx].isAdmin,
    avatarEmoji: dbData.users[userIdx].avatarEmoji,
    profileColor: dbData.users[userIdx].profileColor,
    bio: dbData.users[userIdx].bio
  };

  res.json({ success: true, user: updatedUser, message: "프로필이 멋지게 변경되었습니다!" });
});

/**
 * 14. Submit Report for Posts or Comments
 * POST /api/reports
 */
app.post("/api/reports", (req, res) => {
  const { targetId, targetType, targetTitleOrContent, reason, customReason, reporterId, reporterName } = req.body;

  if (!targetId || !targetType || !reason || !reporterId || !reporterName) {
    return res.status(400).json({ success: false, message: "신고 필수 항목이 수신되지 않았습니다." });
  }

  const dbData = readDB();
  if (!dbData.reports) dbData.reports = [];

  const newReport: Report = {
    id: `report-${Date.now()}`,
    targetId,
    targetType,
    targetTitleOrContent: targetTitleOrContent || "",
    reason,
    customReason: customReason || undefined,
    reporterId,
    reporterName,
    createdAt: new Date().toISOString(),
    resolved: false
  };

  dbData.reports.unshift(newReport);
  writeDB(dbData);

  res.json({ success: true, report: newReport, message: "신고가 정상 접수되었습니다. 교내 안전을 위해 검토하겠습니다." });
});

/**
 * 15. Retrieve Reports List (ADMIN ONLY)
 * GET /api/reports
 */
app.get("/api/reports", (req, res) => {
  const adminIdHeader = req.headers["x-admin-id"] as string;
  const dbData = readDB();
  const requester = dbData.users.find(u => u.id === adminIdHeader);

  if (!requester || !requester.isAdmin) {
    return res.status(403).json({ success: false, message: "신고 목록을 조회할 관리 권한이 없습니다." });
  }

  if (!dbData.reports) dbData.reports = [];
  res.json({ success: true, reports: dbData.reports });
});

/**
 * 16. Resolve Report (ADMIN ONLY)
 * PUT /api/reports/:reportId/resolve
 */
app.put("/api/reports/:reportId/resolve", (req, res) => {
  const adminIdHeader = req.headers["x-admin-id"] as string;
  const reportId = req.params.reportId;

  const dbData = readDB();
  const requester = dbData.users.find(u => u.id === adminIdHeader);

  if (!requester || !requester.isAdmin) {
    return res.status(403).json({ success: false, message: "권한이 없습니다." });
  }

  if (!dbData.reports) dbData.reports = [];
  const idx = dbData.reports.findIndex(r => r.id === reportId);

  if (idx !== -1) {
    dbData.reports[idx].resolved = true;
    writeDB(dbData);
    return res.json({ success: true, message: "신고 건이 해결 상태로 처리되었습니다." });
  }

  res.status(404).json({ success: false, message: "해당 신고 내역을 일치시킬 수 없습니다." });
});

/**
 * 17. Delete / Dismiss Report entirely (ADMIN ONLY)
 * DELETE /api/reports/:reportId
 */
app.delete("/api/reports/:reportId", (req, res) => {
  const adminIdHeader = req.headers["x-admin-id"] as string;
  const reportId = req.params.reportId;

  const dbData = readDB();
  const requester = dbData.users.find(u => u.id === adminIdHeader);

  if (!requester || !requester.isAdmin) {
    return res.status(403).json({ success: false, message: "권한이 없습니다." });
  }

  if (!dbData.reports) dbData.reports = [];
  dbData.reports = dbData.reports.filter(r => r.id !== reportId);
  writeDB(dbData);

  res.json({ success: true, message: "신고 내역이 정상적으로 기각/삭제되었습니다." });
});


// Stand up production and development distribution middlewares for React integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Correct serving of static distribution build directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server boot successful on port ${PORT}`);
  });
}

startServer();
