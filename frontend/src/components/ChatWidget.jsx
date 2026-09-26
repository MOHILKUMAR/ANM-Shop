import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import CartContext from "../context/CartContext.js";
import { OPEN_CHAT_EVENT } from "../data/tickets.js";

const MAX_LENGTH = 1000;

function ActionNotes({ actions }) {
  if (!actions?.length) return null;
  const addedToCart = actions.filter((action) => action.type === "add_to_cart");
  const tickets = actions.filter((action) => action.type === "ticket_created");
  return (
    <div className="mt-2 space-y-2">
      {addedToCart.map((action, index) => (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800" key={`cart-${index}`}>
          Added {action.quantity} × {action.name} to your cart
        </p>
      ))}
      {addedToCart.length > 0 && (
        <Link className="block rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-800" to="/checkout">
          Go to checkout
        </Link>
      )}
      {tickets.map((action) => (
        <Link className="block rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800" key={action.ticketId} to="/support">
          Ticket {action.code} opened · View on your Support page
        </Link>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" role="status" aria-label="Assistant is typing">
      {[0, 1, 2].map((dot) => (
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${dot * 150}ms` }} key={dot} />
      ))}
    </div>
  );
}

// Keyed by the signed-in account (see ChatWidget), so a different account or signing out
// always starts from an empty panel and never sees the previous chat.
function ChatPanel({ open, onClose }) {
  const { user } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext);
  const location = useLocation();
  const [messages, setMessages] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [chatFull, setChatFull] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const token = user?.token;

  // Load the saved conversation once the panel is first shown for this account.
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    apiRequest("/chat", { token })
      .then((data) => {
        if (!active) return;
        setMessages(data.messages);
        setConfigured(data.configured);
        setChatFull(data.turnsLeft <= 0);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setError("");
    setSending(true);
    setDraft("");
    setMessages((current) => [...(current || []), { role: "customer", text, at: new Date().toISOString() }]);
    try {
      const result = await apiRequest("/chat/messages", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      // Only fresh replies change the cart; reloading the transcript never re-applies them.
      for (const action of result.actions) {
        if (action.type === "add_to_cart") {
          for (let count = 0; count < action.quantity; count += 1) addToCart(action.product);
        }
      }
      setMessages((current) => [...current, result.message]);
      setChatFull(result.turnsLeft <= 0);
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1));
      setDraft(text);
      setError(requestError.message);
      if (requestError.data?.chatFull) setChatFull(true);
      if (requestError.status === 503) setConfigured(false);
    } finally {
      setSending(false);
    }
  }

  async function newChat() {
    setError("");
    try {
      await apiRequest("/chat", { method: "DELETE", token });
      setMessages([]);
      setChatFull(false);
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
        <section className={`${open ? "flex" : "hidden"} h-[min(34rem,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl`} aria-label="Support chat">
          <header className="flex items-center justify-between gap-2 bg-brand-700 px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-semibold">ANM-Shop assistant</h2>
              <p className="text-xs text-white/80">Orders, payments, refunds, and shopping help</p>
            </div>
            <div className="flex items-center gap-1">
              {user && (
                <button className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-white/15 disabled:opacity-50" type="button" onClick={newChat} disabled={sending}>
                  New chat
                </button>
              )}
              <button className="rounded-md p-1.5 hover:bg-white/15" type="button" aria-label="Close chat" onClick={onClose}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </header>

          {!user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-gray-700">Sign in to chat about your orders, payments, and refunds.</p>
              <Link className="gradient-action" to="/login" state={{ from: location.pathname }} onClick={onClose}>Sign in</Link>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" ref={listRef} aria-live="polite">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">
                  Hi {user.name.split(" ")[0]}! I can check your orders, payments, and refunds, help you find and add products to your cart, or open a support ticket.
                </div>
                {messages?.map((message, index) => (
                  message.role === "customer" ? (
                    <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand-700 px-3 py-2 text-sm text-white" key={index}>{message.text}</div>
                  ) : (
                    <div className="max-w-[85%]" key={index}>
                      <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">{message.text}</div>
                      <ActionNotes actions={message.actions} />
                    </div>
                  )
                ))}
                {!messages && !error && <TypingDots />}
                {sending && <TypingDots />}
              </div>

              <div className="border-t border-gray-200 p-3">
                {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p>}
                {!configured ? (
                  <p className="text-xs text-gray-600">The assistant is offline. <Link className="font-semibold text-brand-700" to="/support" onClick={onClose}>Open a support ticket</Link> instead.</p>
                ) : chatFull ? (
                  <p className="text-xs text-gray-600">This chat is full. Press <strong>New chat</strong> to continue.</p>
                ) : (
                  <form className="flex items-end gap-2" onSubmit={send}>
                    <label className="sr-only" htmlFor="chat-input">Message</label>
                    <textarea
                      id="chat-input"
                      ref={inputRef}
                      className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      rows={1}
                      maxLength={MAX_LENGTH}
                      placeholder="Ask about an order or a refund…"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) send(event);
                      }}
                    />
                    <button className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50" type="submit" disabled={sending || !draft.trim() || !messages}>
                      Send
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
  );
}

function ChatWidget() {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  // The panel mounts on first open, so no chat request is made for visitors who never use it.
  const [started, setStarted] = useState(false);
  const show = () => {
    setStarted(true);
    setOpen(true);
  };

  useEffect(() => {
    const handleOpen = () => {
      setStarted(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHAT_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handleOpen);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
      {started && <ChatPanel key={user?.token || "signed-out"} open={open} onClose={() => setOpen(false)} />}
      <button
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg transition hover:bg-brand-800"
        type="button"
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />}
        </svg>
      </button>
    </div>
  );
}

export default ChatWidget;
