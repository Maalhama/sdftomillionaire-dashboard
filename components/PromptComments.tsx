'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { MessageSquare, Send, Trash2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  author_name: string | null;
  profiles?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function PromptComments({ promptId }: { promptId: string }) {
  const { user, session, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill author name from profile
  useEffect(() => {
    if (profile?.display_name) {
      setAuthorName(profile.display_name);
    } else if (profile?.username) {
      setAuthorName(profile.username);
    }
  }, [profile]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    fetchComments();

    // Realtime subscription
    const channel = supabase
      .channel(`comments-${promptId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'prompt_comments',
        filter: `prompt_id=eq.${promptId}`,
      }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [promptId, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/prompts/${promptId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: newComment.trim(),
          author_name: authorName.trim() || 'Anonyme',
        }),
      });

      if (res.ok) {
        setNewComment('');
        await fetchComments();
      }
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!session?.access_token) return;

    try {
      await supabase
        .from('prompt_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user!.id);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* silent */ }
  };

  const getDisplayName = (comment: Comment) => {
    return comment.profiles?.display_name || comment.profiles?.username || comment.author_name || 'Anonyme';
  };

  return (
    <div className="border-t border-hacker-border p-5">
      <h4 className="text-xs uppercase tracking-wider text-hacker-muted-light mb-3 font-mono flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5" />
        commentaires ({comments.length})
      </h4>

      {/* Comments list */}
      {loading ? (
        <p className="text-xs text-hacker-muted font-mono animate-pulse">Chargement...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-hacker-muted font-mono mb-3">// aucun commentaire</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 group">
              <div className="w-5 h-5 rounded-full bg-hacker-green/10 border border-hacker-green/20 flex items-center justify-center shrink-0 mt-0.5">
                {comment.profiles?.avatar_url ? (
                  <img src={comment.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <span className="text-[9px] text-hacker-green font-bold">
                    {getDisplayName(comment)[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-hacker-green font-mono font-bold">
                    {getDisplayName(comment)}
                  </span>
                  <span className="text-[10px] text-hacker-muted font-mono">
                    {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {user?.id && user.id === comment.user_id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="opacity-0 group-hover:opacity-100 text-hacker-muted hover:text-hacker-red transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-hacker-text leading-relaxed">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment form — visible pour tous */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {!user && (
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Ton pseudo"
            maxLength={30}
            className="w-full bg-hacker-terminal border border-hacker-border rounded px-3 py-1.5 text-xs text-hacker-text font-mono placeholder:text-hacker-muted focus:border-hacker-green/50 focus:outline-none transition-colors"
          />
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            maxLength={500}
            className="flex-1 bg-hacker-terminal border border-hacker-border rounded px-3 py-1.5 text-xs text-hacker-text font-mono placeholder:text-hacker-muted focus:border-hacker-green/50 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="p-1.5 rounded border border-hacker-green/30 text-hacker-green hover:bg-hacker-green/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send className={`w-3.5 h-3.5 ${submitting ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </form>
    </div>
  );
}
