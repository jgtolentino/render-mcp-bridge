/**
 * User Provisioning Endpoint
 * Auto-creates te.users record on first OAuth login
 * Maps Supabase auth.users -> te.users
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export async function POST(req: Request) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No authorization token provided' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    // Get user info from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    const user = authData.user as SupabaseUser;
    const uid = user.id;
    const email = user.email || '';
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
    const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0] || 'unknown';

    // Check if user already exists in te.users
    const { data: existingUser, error: checkError } = await supabase
      .from('te.users')
      .select('id, auth_user_id, display_name, email, role')
      .eq('auth_user_id', uid)
      .single();

    if (existingUser) {
      // User already exists
      return new Response(
        JSON.stringify({
          ok: true,
          user: existingUser,
          message: 'User already exists'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    // Determine role based on email domain or default to employee
    const role = determineUserRole(email);

    // Create new user in te.users
    const { data: newUser, error: createError } = await supabase
      .from('te.users')
      .upsert({
        auth_user_id: uid,
        tenant_id: DEFAULT_TENANT_ID,
        display_name: fullName,
        email: email,
        role: role,
        is_active: true,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,auth_user_id'
      })
      .select()
      .single();

    if (createError) {
      console.error('User provisioning error:', createError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Failed to provision user: ${createError.message}`
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user: newUser,
        message: 'User provisioned successfully',
        provider: provider
      }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Ensure user error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Determine user role based on email domain or other criteria
 * Can be customized based on your org's requirements
 */
function determineUserRole(email: string): string {
  // Default role
  let role = 'employee';

  // Example: Assign roles based on email domain
  if (email.endsWith('@admin.company.com')) {
    role = 'admin';
  } else if (email.endsWith('@finance.company.com')) {
    role = 'finance';
  } else if (email.includes('+approver@')) {
    role = 'approver';
  }

  // Add more role assignment logic as needed
  return role;
}

/**
 * GET endpoint to check current user status
 */
export async function GET(req: Request) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No authorization token' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid token' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from('te.users')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'User not found in database',
          auth_user_id: authData.user.id
        }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, user: userData }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
