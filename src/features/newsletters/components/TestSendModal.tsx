import { useState } from "react";
import { getErrorMessage } from "@/api/client";
import { MAX_TEST_RECIPIENTS } from "@/api/newsletters";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { parseEmailList } from "../newsletterContent";

interface TestSendModalProps {
  defaultEmail: string;
  onSend: (emails: string[]) => Promise<void>;
  onClose: () => void;
}

/** Sends the saved newsletter to a few addresses first - subject prefixed "[TEST]", merge tags filled with sample values. */
export function TestSendModal({ defaultEmail, onSend, onClose }: TestSendModalProps) {
  const [text, setText] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    const { valid, invalid } = parseEmailList(text);
    if (invalid.length > 0) {
      setError(`Not a valid address: ${invalid.join(", ")}`);
      return;
    }
    if (valid.length === 0 || valid.length > MAX_TEST_RECIPIENTS) {
      setError(`Enter between 1 and ${MAX_TEST_RECIPIENTS} addresses.`);
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(valid);
      setSent(true);
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't send the test."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Send a test">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {sent && <Alert variant="success">Test sent. It can take a minute to arrive.</Alert>}
        <FormField
          label="Send to"
          htmlFor="newsletter-test-emails"
          description={`Up to ${MAX_TEST_RECIPIENTS} addresses, separated by commas. Your changes are saved first.`}
        >
          <Input
            id="newsletter-test-emails"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={sending}
            className="w-full sm:w-auto"
          >
            {sent ? "Done" : "Cancel"}
          </Button>
          <Button onClick={() => void submit()} loading={sending} className="w-full sm:w-auto">
            {sent ? "Send again" : "Send test"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
