import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace - COCO",
  description: "AI-Powered Coding Workspace",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
