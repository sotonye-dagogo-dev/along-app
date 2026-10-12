interface ValidationRule {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  message: string;
}

export const VALIDATION_RULES: Record<string, ValidationRule> = {
  userName: {
    pattern: /^[a-zA-Z0-9_]{3,30}$/,
    message: "Username must be 3-30 characters (letters, numbers, underscores only).",
  },
  password: {
    minLength: 8,
    maxLength: 128,
    message: "Password must be between 8 and 128 characters.",
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Please enter a valid email address.",
  },
  bio: {
    maxLength: 160,
    message: "Bio must be 160 characters or fewer.",
  },
  postTitle: {
    minLength: 5,
    maxLength: 200,
    message: "Title must be between 5 and 200 characters.",
  },
  commentText: {
    minLength: 1,
    maxLength: 1000,
    message: "Comment must be between 1 and 1000 characters.",
  },
  rating: {
    min: 1,
    max: 5,
    message: "Rating must be between 1 and 5.",
  },
};
