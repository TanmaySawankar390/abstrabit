"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Bookmark = {
  id: string;
  title: string;
  url: string;
  inserted_at: string;
  user_id: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeUrl = (value: string) => {
  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return value;
    }
  }
};

export default function Home() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = useMemo(
    () => Boolean(supabaseUrl && supabaseAnonKey),
    []
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      const session = data.session;
      setSessionUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
      if (!session) {
        setBookmarks([]);
        setLoading(false);
      }
    };

    init();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
      if (!session) {
        setBookmarks([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadBookmarks = async (userId: string) => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id,title,url,inserted_at,user_id")
        .eq("user_id", userId)
        .order("inserted_at", { ascending: false });
      if (!mounted) {
        return;
      }
      if (error) {
        setError(error.message);
        setBookmarks([]);
      } else {
        setBookmarks(data ?? []);
      }
      setLoading(false);
    };

    if (!sessionUserId) {
      return () => {
        mounted = false;
      };
    }

    loadBookmarks(sessionUserId);

    const channel = supabase
      .channel(`bookmarks:${sessionUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${sessionUserId}`,
        },
        (payload) => {
          if (!mounted) {
            return;
          }
          if (payload.eventType === "INSERT") {
            const newBookmark = payload.new as Bookmark;
            setBookmarks((prev) =>
              prev.some((item) => item.id === newBookmark.id)
                ? prev
                : [newBookmark, ...prev]
            );
          }
          if (payload.eventType === "UPDATE") {
            const updatedBookmark = payload.new as Bookmark;
            setBookmarks((prev) =>
              prev.map((item) =>
                item.id === updatedBookmark.id ? updatedBookmark : item
              )
            );
          }
          if (payload.eventType === "DELETE") {
            const removedBookmark = payload.old as Bookmark;
            setBookmarks((prev) =>
              prev.filter((item) => item.id !== removedBookmark.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [sessionUserId]);

  const handleSignIn = async () => {
    setError(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setError(error.message);
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    setAuthBusy(false);
    if (error) {
      setError(error.message);
    }
  };

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionUserId) {
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle || !trimmedUrl) {
      setError("Title and URL are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const normalizedUrl = normalizeUrl(trimmedUrl);
    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        title: trimmedTitle,
        url: normalizedUrl,
        user_id: sessionUserId,
      })
      .select("id,title,url,inserted_at,user_id")
      .single();
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setBookmarks((prev) =>
        prev.some((item) => item.id === data.id) ? prev : [data, ...prev]
      );
      setTitle("");
      setUrl("");
    }
  };

  const handleDelete = async (bookmarkId: string) => {
    if (!sessionUserId) {
      return;
    }
    setDeletingId(bookmarkId);
    setError(null);
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId)
      .eq("user_id", sessionUserId);
    setDeletingId(null);
    if (error) {
      setError(error.message);
    } else {
      setBookmarks((prev) =>
        prev.filter((bookmark) => bookmark.id !== bookmarkId)
      );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Smart Bookmark App
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Your private bookmarks</h1>
              <p className="text-sm text-zinc-600">
                Add a URL with a title and see updates in real time.
              </p>
            </div>
            {sessionUserId ? (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={authBusy}
                className="h-10 rounded-full border border-zinc-300 px-6 text-sm font-medium transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={authBusy || !isConfigured}
                className="h-10 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Continue with Google
              </button>
            )}
          </div>
        </header>

        {!isConfigured ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
            enable login.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {sessionUserId ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="Design resources"
                  maxLength={120}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  URL
                </label>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="https://example.com"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {submitting ? "Saving..." : "Add bookmark"}
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Sign in with Google to manage your bookmarks.
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bookmarks</h2>
            {sessionUserId && userEmail ? (
              <span className="text-xs text-zinc-500">{userEmail}</span>
            ) : null}
          </div>
          {loading ? (
            <div className="mt-6 text-sm text-zinc-500">Loading bookmarks...</div>
          ) : bookmarks.length === 0 ? (
            <div className="mt-6 text-sm text-zinc-500">
              No bookmarks yet. Add your first one above.
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {bookmarks.map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{bookmark.title}</span>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-500 hover:text-zinc-800"
                    >
                      {bookmark.url}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(bookmark.id)}
                    disabled={deletingId === bookmark.id}
                    className="h-9 rounded-full border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === bookmark.id ? "Removing" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
