import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/admin/build/complete
 *
 * Marque manuellement un build comme terminé (Wizard of Oz).
 * Auth via header x-admin-secret.
 *
 * Body: {
 *   prompt_id: string (required)
 *   tool_name?: string
 *   tool_description?: string
 *   tool_url?: string
 * }
 */
export async function POST(request: NextRequest) {
  // Auth check
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Non autorisé.' },
      { status: 401 }
    );
  }

  const supabase = getSupabase();

  try {
    const { prompt_id, tool_name, tool_description, tool_url } = await request.json();

    if (!prompt_id) {
      return NextResponse.json(
        { error: 'prompt_id requis.' },
        { status: 400 }
      );
    }

    // Verify prompt exists and is in building state
    const { data: prompt, error: fetchError } = await supabase
      .from('user_prompts')
      .select('id, status, content, author_name, ai_plan')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      return NextResponse.json(
        { error: 'Prompt introuvable.' },
        { status: 404 }
      );
    }

    if (prompt.status !== 'building') {
      return NextResponse.json(
        { error: `Le prompt est en statut "${prompt.status}", attendu "building".` },
        { status: 400 }
      );
    }

    // Update prompt to completed
    await supabase
      .from('user_prompts')
      .update({
        status: 'completed',
      })
      .eq('id', prompt_id);

    // Create tool entry if info provided
    if (tool_name) {
      const slug = tool_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const buildPlan = prompt.ai_plan?.build_plan || {};

      await supabase.from('tools').insert({
        prompt_id,
        name: tool_name,
        slug,
        description: tool_description || buildPlan.project_description || prompt.content,
        tech_stack: buildPlan.tech_stack || [],
        download_url: tool_url || null,
        status: tool_url ? 'published' : 'draft',
        built_by: ['opus', 'creator', 'brain'],
        published_at: tool_url ? new Date().toISOString() : null,
      });
    }

    // Fire CEO validation event
    const projectName = prompt.ai_plan?.build_plan?.project_name || 'le projet';
    await supabase.from('ops_agent_events').insert({
      agent_id: 'opus',
      kind: 'build_completed',
      title: `[${projectName}] Build terminé et validé`,
      summary: `Le CEO a validé le build de "${projectName}". ${tool_name ? `Outil créé : ${tool_name}.` : 'En attente de publication.'}`,
      tags: ['build_completed', 'admin', 'opus'],
      metadata: {
        prompt_id,
        tool_name: tool_name || null,
        completed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      status: 'completed',
      tool_created: !!tool_name,
    });
  } catch (err) {
    console.error('Admin build complete error:', err);
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
