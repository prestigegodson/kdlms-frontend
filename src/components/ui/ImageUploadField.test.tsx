import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as filesApi from "@/api/files";
import { ImageUploadField } from "@/components/ui/ImageUploadField";

vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return { ...actual, uploadFile: vi.fn(), downloadFile: vi.fn() };
});

function oversizeFile(): File {
  const file = new File(["fake-bytes"], "big.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: filesApi.MAX_UPLOAD_BYTES + 1 });
  return file;
}

describe("ImageUploadField", () => {
  it("shows the max-size hint", () => {
    render(<ImageUploadField label="Photo" onChange={vi.fn()} />);
    expect(screen.getByText(/max 2 MB/)).toBeInTheDocument();
  });

  it("rejects a file over 2 MB without uploading it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ImageUploadField label="Photo" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, oversizeFile());

    expect(await screen.findByText(/larger than 2 MB/)).toBeInTheDocument();
    expect(filesApi.uploadFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still uploads a file within the size limit", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "file-1",
      fileName: "small.png",
      contentType: "image/png",
      sizeBytes: 1024,
    });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ImageUploadField label="Photo" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake-bytes"], "small.png", { type: "image/png" });
    await user.upload(input, file);

    expect(filesApi.uploadFile).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenCalledWith("file-1");
  });
});
