import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/app/providers/I18nProvider";
import { PostMenu, type PostMenuPost } from "@/app/components/features/moderation/PostMenu";
import { POST_ACTIONS_CONFIG } from "@/app/lib/config";

const basePost: PostMenuPost = {
  id: "post-1",
  title: "Lekki to Ikoyi",
  routes: [],
  images: [],
  tags: [],
  user: { id: "owner-1" },
};

function renderMenu(viewerId: string | null, viewerRole?: string | null, post: PostMenuPost = basePost) {
  return render(
    <I18nProvider>
      <PostMenu
        post={post}
        title={post.title}
        viewerId={viewerId}
        viewerRole={viewerRole}
        requireAuth={() => true}
        onEdit={() => {}}
        onDeleted={() => {}}
        onRestored={() => {}}
        onArchivedChanged={() => {}}
      />
    </I18nProvider>
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /more options/i }));
}

describe("PostMenu visibility (owner-only management)", () => {
  it("shows Edit / Archive / Delete to the post owner", () => {
    renderMenu("owner-1", "USER");
    openMenu();
    expect(screen.getByText(POST_ACTIONS_CONFIG.copyLinkLabel)).toBeInTheDocument();
    expect(screen.getByText(POST_ACTIONS_CONFIG.editLabel)).toBeInTheDocument();
    expect(screen.getByText(POST_ACTIONS_CONFIG.archiveLabel)).toBeInTheDocument();
    expect(screen.getByText(POST_ACTIONS_CONFIG.deleteLabel)).toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.reportLabel)).not.toBeInTheDocument();
  });

  it("hides Archive / Delete / Edit from admins viewing someone else's post", () => {
    renderMenu("admin-9", "ADMIN");
    openMenu();
    expect(screen.getByText(POST_ACTIONS_CONFIG.copyLinkLabel)).toBeInTheDocument();
    expect(screen.getByText(POST_ACTIONS_CONFIG.reportLabel)).toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.archiveLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.unarchiveLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.deleteLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.editLabel)).not.toBeInTheDocument();
  });

  it("hides Archive / Delete from regular viewers", () => {
    renderMenu("viewer-2", "USER");
    openMenu();
    expect(screen.getByText(POST_ACTIONS_CONFIG.reportLabel)).toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.archiveLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.deleteLabel)).not.toBeInTheDocument();
  });

  it("shows Unarchive (not Archive) to the owner of an archived post", () => {
    renderMenu("owner-1", "USER", { ...basePost, isArchived: true } as PostMenuPost);
    openMenu();
    expect(screen.getByText(POST_ACTIONS_CONFIG.unarchiveLabel)).toBeInTheDocument();
    expect(screen.queryByText(POST_ACTIONS_CONFIG.archiveLabel)).not.toBeInTheDocument();
  });
});
