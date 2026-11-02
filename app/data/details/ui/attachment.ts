import type { ComponentDetail } from "@/app/data/component-detail-types";

export const ATTACHMENT_DETAIL: ComponentDetail = {
    description:
      "A compact file attachment primitive with media, metadata, actions, trigger overlay, grouped scrolling, and upload/error/done states.",
    usage: `import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription } from "@/components/ui/attachment";

<Attachment>
  <AttachmentMedia />
  <AttachmentContent>
    <AttachmentTitle>roadmap.pdf</AttachmentTitle>
    <AttachmentDescription>2.4 MB</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    props: [
      {
        name: "variant",
        type: '"default" | "preview"',
        default: '"default"',
        description: "Preview cards use a title header above an 80px thumbnail, with a raised surface.",
      },
      {
        name: "state",
        type: '"idle" | "uploading" | "processing" | "error" | "done"',
        default: '"done"',
        description: "Attachment lifecycle state used for visual treatment.",
      },
      {
        name: "size",
        type: '"default" | "sm" | "xs"',
        default: '"default"',
        description: "Compactness of the attachment shell and media.",
      },
      {
        name: "orientation",
        type: '"horizontal" | "vertical"',
        default: '"horizontal"',
        description: "Layout direction for media and metadata.",
      },
    ],
    subComponents: [
      { name: "AttachmentGroup", description: "Scrollable row of attachments." },
      { name: "AttachmentMedia", description: "Icon or image thumbnail." },
      { name: "AttachmentContent", description: "Metadata container." },
      { name: "AttachmentHeader", description: "Title, icon, and actions above a preview thumbnail." },
      { name: "AttachmentTitle", description: "Primary attachment label." },
      { name: "AttachmentDescription", description: "Secondary metadata text." },
      { name: "AttachmentActions", description: "Action button container." },
      { name: "AttachmentAction", description: "Small action button." },
      { name: "AttachmentTrigger", description: "Overlay trigger for click targets." },
    ],
    examples: [
      { title: "Default", demoSlug: "attachment-demo-default" },
      {
        title: "Files",
        description: "Horizontal and vertical file attachments.",
        demoSlug: "attachment-demo-files",
      },
      {
        title: "Content Only",
        description: "Attachments with title-only and title-plus-description content.",
        demoSlug: "attachment-demo-content-only",
      },
      {
        title: "States",
        description: "Idle, uploading, processing, done, and error states.",
        demoSlug: "attachment-demo-states",
      },
      {
        title: "Images",
        description: "Image media attachments with full-card triggers.",
        demoSlug: "attachment-demo-images",
      },
      {
        title: "Image States",
        description: "Image attachments across upload lifecycle states.",
        demoSlug: "attachment-demo-image-states",
      },
      {
        title: "Sizes",
        description: "Default, small, and extra-small attachment sizes.",
        demoSlug: "attachment-demo-sizes",
      },
      {
        title: "Group",
        description: "Scrollable attachment group with snapping behavior.",
        demoSlug: "attachment-demo-group",
      },
      {
        title: "Trigger",
        description: "Full-card link and dialog triggers with independent actions.",
        demoSlug: "attachment-demo-trigger",
      },
      {
        title: "Orientation",
        description: "Horizontal and vertical attachment layouts.",
        demoSlug: "attachment-demo-orientation",
      },
    ],
  };
