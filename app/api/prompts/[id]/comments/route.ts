import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  const promptId = params.id;

  const { data: comments, error } = await supabase
    .from('prompt_comments')
    .select('id, content, created_at, user_id, profiles(display_name, username, avatar_url)')
    .eq('prompt_id', promptId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement.' }, { status: 500 });
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  const promptId = params.id;

  // Auth required
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
  if (authError || !user) {
    return NextResponse.json({ error: 'Token invalide.' }, { status: 401 });
  }

  const body = await req.json();
  const content = body.content?.trim();

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
      user_id: user.id,
      content,
    })
    .select('id, content, created_at, user_id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Erreur lors de l\'ajout.' }, { status: 500 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
