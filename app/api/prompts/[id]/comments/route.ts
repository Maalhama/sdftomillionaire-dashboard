import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  const { id: promptId } = await params;

  const { data: comments, error } = await supabase
    .from('prompt_comments')
    .select('id, content, created_at, user_id, author_name')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Comments fetch error:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  const { id: promptId } = await params;

  // Auth optionnelle
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    console.error('Comments parse error:', err);
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const content = body.content?.trim();
  const authorName = (body.author_name?.trim() || 'Anonyme').slice(0, 50);

  if (!content || content.length === 0) {
    return NextResponse.json({ error: 'Commentaire vide.' }, { status: 400 });
  }

  if (content.length > 500) {
    return NextResponse.json({ error: 'Commentaire trop long (max 500 caractères).' }, { status: 400 });
  }

  // Check prompt exists
  const { data: prompt } = await supabase
    .from('user_prompts')
    .select('id')
    .eq('id', promptId)
    .single();

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt introuvable.' }, { status: 404 });
  }

  const { data: comment, error: insertError } = await supabase
    .from('prompt_comments')
    .insert({
      prompt_id: promptId,
      user_id: userId,
      author_name: authorName,
      content,
    })
    .select('id, content, created_at, user_id, author_name')
    .single();

  if (insertError) {
    console.error('Comment insert error:', insertError);
    return NextResponse.json({ error: 'Erreur lors de l\'ajout.' }, { status: 500 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
