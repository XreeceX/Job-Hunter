/**
 * GET /api/profile – return current user profile
 * PUT /api/profile – update profile (JSON body)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateProfile, updateProfile } from '@/lib/services/user-profile.service';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().nullable().optional(),
  targetRole: z.string().nullable().optional(),
  experienceSummary: z.string().nullable().optional(),
  skills: z.string().nullable().optional(),
  resumeText: z.string().nullable().optional(),
  customQa: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .nullable()
    .optional(),
  preferences: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const profile = await getOrCreateProfile();
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      targetRole: profile.targetRole,
      experienceSummary: profile.experienceSummary,
      skills: profile.skills,
      resumeText: profile.resumeText ? '[stored]' : null,
      resumeFileName: profile.resumeFileName,
      customQa: profile.customQa,
      preferences: profile.preferences,
    });
  } catch (e) {
    console.error('Profile get error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const profile = await updateProfile(parsed.data);
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      targetRole: profile.targetRole,
      experienceSummary: profile.experienceSummary,
      skills: profile.skills,
      resumeFileName: profile.resumeFileName,
      customQa: profile.customQa,
      preferences: profile.preferences,
    });
  } catch (e) {
    console.error('Profile update error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}
