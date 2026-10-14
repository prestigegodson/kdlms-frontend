import type { ContactEnquiryView } from "@/api/contactEnquiries";
import type { Page } from "@/api/types";

export function enquiry(overrides: Partial<ContactEnquiryView> = {}): ContactEnquiryView {
  return {
    id: "e1",
    schoolName: "Bright Futures Academy",
    address: "1 School Road\nIkeja",
    contactEmail: "head@bright.example",
    contactPhone: "+2348012345678",
    contactPersonName: "Ada Obi",
    message: "Please tell us about pricing.",
    status: "NEW",
    createdAt: "2026-10-13T09:30:00Z",
    updatedAt: "2026-10-13T09:30:00Z",
    ...overrides,
  };
}

export function page(content: ContactEnquiryView[]): Page<ContactEnquiryView> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}
