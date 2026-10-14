import type { ContactEnquiryStatus } from "@/api/contactEnquiries";

export const ENQUIRY_STATUS_LABEL: Record<ContactEnquiryStatus, string> = {
  NEW: "New",
  READ: "Read",
  RESOLVED: "Resolved",
};

export const ENQUIRY_STATUS_VARIANT: Record<ContactEnquiryStatus, "info" | "neutral" | "success"> =
  {
    NEW: "info",
    READ: "neutral",
    RESOLVED: "success",
  };
