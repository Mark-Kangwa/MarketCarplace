"use client";
import { useState } from "react";
import { toWhatsAppDigits } from "@/lib/phone";

function WhatsAppGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3.2 3.9c-.2 0-.4 0-.6.2-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.4-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a7.5 7.5 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5L8.9 8.1c-.2-.4-.3-.3-.7-.2Z" />
    </svg>
  );
}

export default function ContactSeller({
  dealerName,
  dealerPhone,
  title,
  priceLabel,
  carId,
  accountId
}: {
  dealerName: string;
  dealerPhone: string | null;
  title: string;
  priceLabel: string;
  carId: string;
  accountId: string | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState(`Hi, I'm interested in ${title} at ${priceLabel}. Is it still available?`);

  const phoneDigits = dealerPhone ? dealerPhone.replace(/\s/g, "") : "";
  const waDigits = dealerPhone ? toWhatsAppDigits(dealerPhone) : "";
  const waChatUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi, I'm interested in ${title} at ${priceLabel}. Is it still available?`)}`
    : "";

  function composedText(): string {
    const who = name.trim() ? `\n\n— ${name.trim()}${contact.trim() ? ` (${contact.trim()})` : ""}` : contact.trim() ? `\n\n— ${contact.trim()}` : "";
    return `${message.trim()}${who}`;
  }

  function recordEnquiry(channel: "MESSAGE" | "WHATSAPP" | "SHOW_NUMBER", message?: string): void {
    if (!accountId) return;
    fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carId, channel, message: message ?? "" }),
      keepalive: true
    }).catch(() => undefined);
  }

  function onSend(e: React.FormEvent): void {
    e.preventDefault();
    recordEnquiry("MESSAGE", composedText());
    const text = encodeURIComponent(composedText());
    const url = waDigits
      ? `https://wa.me/${waDigits}?text=${text}`
      : `mailto:?subject=${encodeURIComponent(`Enquiry: ${title}`)}&body=${text}`;
    window.open(url, "_blank", "noopener");
  }

  function onToggle(): void {
    // Expanding the panel is navigation, not contact — records nothing.
    setOpen((v) => !v);
  }

  function onShowNumber(): void {
    recordEnquiry("SHOW_NUMBER");
    setRevealed(true);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="block w-full rounded border border-line px-4 py-2.5 text-center text-sm font-semibold hover:bg-lot"
      >
        {open ? "Hide contact options" : "Message dealer"}
      </button>

      {waChatUrl ? (
        <a
          href={waChatUrl}
          target="_blank"
          rel="noopener"
          onClick={() => recordEnquiry("WHATSAPP")}
          aria-label={`Chat on WhatsApp with ${dealerName}`}
          className="flex items-center justify-center gap-2 rounded bg-[#25D366] px-4 py-2.5 text-center text-sm font-bold text-white hover:brightness-105"
        >
          <WhatsAppGlyph /> Chat on WhatsApp
        </a>
      ) : null}

      {open ? (
        <div className="space-y-2 rounded-lg border border-line bg-lot/60 p-3">
          {dealerPhone ? (
            <>
              {revealed ? (
                <a
                  href={`tel:${phoneDigits}`}
                  className="block rounded bg-signal px-4 py-2.5 text-center text-sm font-bold text-white hover:brightness-110"
                >
                  Call {dealerPhone}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onShowNumber}
                  className="block w-full rounded bg-asphalt px-4 py-2.5 text-center text-sm font-bold text-white hover:brightness-110"
                >
                  Show number
                </button>
              )}
              <a
                href={waChatUrl}
                target="_blank"
                rel="noopener"
                onClick={() => recordEnquiry("WHATSAPP")}
                className="flex items-center justify-center gap-2 rounded bg-[#25D366] px-4 py-2.5 text-center text-sm font-bold text-white hover:brightness-105"
              >
                <WhatsAppGlyph /> WhatsApp
              </a>
            </>
          ) : (
            <p className="rounded bg-white p-3 text-center text-sm text-gray-600">Call the dealer on the number listed in-store. Online enquiries coming soon.</p>
          )}

          <form onSubmit={onSend} className="space-y-2 rounded-lg border border-line bg-white p-3">
            <p className="text-sm font-bold">Message {dealerName}</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Your phone or email"
              aria-label="Your phone or email"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              aria-label="Message to dealer"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <button type="submit" className="block w-full rounded bg-signal px-4 py-2.5 text-center text-sm font-bold text-white hover:brightness-110">
              Send Message
            </button>
            <p className="text-[11px] leading-snug text-gray-500">
              By continuing I understand and agree with Pazengo&apos;s Terms &amp; Conditions and Privacy Policy.
            </p>
          </form>

          <p className="text-center text-xs text-gray-500">
            Prefer email?{" "}
            <a
              href={`mailto:?subject=${encodeURIComponent(`Enquiry: ${title}`)}&body=${encodeURIComponent(`Hi, I'm interested in ${title} at ${priceLabel}. Please contact me.`)}`}
              className="font-semibold text-trader hover:underline"
            >
              Send via email
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
