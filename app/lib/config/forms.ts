import { Mail, Lock, User, Phone, MessageSquare, Camera, Bug } from "lucide-react";
import type { FieldConfig } from "@/app/lib/types";

export const REGISTER_FIELDS: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", placeholder: "Enter your first name", required: true, icon: User },
  { name: "lastName", label: "Last Name", type: "text", placeholder: "Enter your last name", required: true, icon: User },
  { name: "userName", label: "Username", type: "text", placeholder: "Choose a username", required: true, icon: User },
  { name: "email", label: "Email", type: "email", placeholder: "you@example.com", required: true, icon: Mail },
  { name: "password", label: "Password", type: "password", placeholder: "Create a password", required: true, icon: Lock },
];

export const LOGIN_FIELDS: FieldConfig[] = [
  { name: "email", label: "Email", type: "email", placeholder: "you@example.com", required: true, icon: Mail },
  { name: "password", label: "Password", type: "password", placeholder: "Enter your password", required: true, icon: Lock },
];

export const EDIT_PROFILE_FIELDS: FieldConfig[] = [
  { name: "userName", label: "Username", type: "text", placeholder: "Choose a unique username", required: true, icon: User },
  { name: "firstName", label: "First Name", type: "text", required: true, icon: User },
  { name: "lastName", label: "Last Name", type: "text", required: true, icon: User },
  { name: "bio", label: "Bio", type: "textarea", placeholder: "Tell us about yourself", icon: MessageSquare },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+234...", icon: Phone },
];

/** Shared username rules (mirrors REGISTER_SCHEMA so edit + signup agree). */
export const USERNAME_RULE = {
  minLength: 3,
  maxLength: 30,
  pattern: /^[a-zA-Z0-9_]+$/,
  hint: "Username can only contain letters, numbers, and underscores",
} as const;

export const POST_CREATE_FIELDS: FieldConfig[] = [
  { name: "title", label: "Route Title", type: "text", placeholder: "E.g., Yaba to Ikeja via Oshodi", required: true },
  { name: "description", label: "Description", type: "textarea", placeholder: "Describe the route experience..." },
  { name: "images", label: "Photos", type: "file", icon: Camera },
];

export const BUG_REPORT_FIELDS: FieldConfig[] = [
  { name: "title", label: "Bug Title", type: "text", placeholder: "Brief summary of the issue", required: true },
  { name: "category", label: "Category", type: "select", required: true, options: [
    { label: "UI", value: "UI" },
    { label: "Routing", value: "ROUTING" },
    { label: "Auth", value: "AUTH" },
    { label: "Performance", value: "PERFORMANCE" },
    { label: "Data", value: "DATA" },
    { label: "Notifications", value: "NOTIFICATIONS" },
    { label: "Other", value: "OTHER" },
  ]},
  { name: "description", label: "Description", type: "textarea", placeholder: "Steps to reproduce...", required: true, icon: Bug },
];

export const CONTACT_FIELDS: FieldConfig[] = [
  { name: "name", label: "Your Name", type: "text", required: true, icon: User },
  { name: "email", label: "Your Email", type: "email", required: true, icon: Mail },
  { name: "message", label: "Message", type: "textarea", required: true, icon: MessageSquare },
];
