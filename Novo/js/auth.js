// ============================================================================
// MÓDULO DE AUTENTICAÇÃO - COTADOR v5.9
// ============================================================================

window.CotadorAuth = {
  supabase: null,

  init() {
    if (this.supabase) return this.supabase;
    const rawUrl = window.Cotador?.core?.SUPABASE_URL || "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1";
    const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
    const supabaseKey = window.Cotador?.core?.SUPABASE_KEY || "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N";

    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  },

  _ensureClient() {
    return this.supabase || this.init();
  },

  _createIsolatedClient() {
    const rawUrl = window.Cotador?.core?.SUPABASE_URL || "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1";
    const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
    const supabaseKey = window.Cotador?.core?.SUPABASE_KEY || "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N";
    return window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  },

  async login(email, password) {
    const client = this._ensureClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: password,
    });
    if (error) throw error;

    if (data?.user?.id) {
      try {
        const { data: profile } = await client
          .from('user_profiles')
          .select('status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile && profile.status === 'revoked') {
          await client.auth.signOut();
          throw new Error('ACESSO_REVOGADO');
        }
      } catch (err) {
        if (err.message === 'ACESSO_REVOGADO') throw err;
      }
    }
    return data;
  },

  async logout() {
    const client = this._ensureClient();
    if (client) await client.auth.signOut();
    window.location.href = 'login.html';
  },

  async getSession() {
    const client = this._ensureClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return data.session;
  },

  async solicitarAcesso(nome, email, motivo) {
    const client = this._ensureClient();
    const { error } = await client
      .from('access_requests')
      .insert([{
        nome: String(nome || '').trim(),
        email: String(email || '').trim().toLowerCase(),
        motivo: String(motivo || '').trim(),
        status: 'pending'
      }]);
    if (error) throw error;
  },

  async criarUsuarioVisualizadorDireto({ nome, email, password, requestId = null }) {
    const client = this._ensureClient();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanNome = String(nome || '').trim();
    const cleanPass = String(password || '').trim();

    const { data: rpcUserId, error: rpcErr } = await client.rpc('admin_provisionar_usuario', {
      p_email: cleanEmail,
      p_nome: cleanNome,
      p_password: cleanPass,
      p_request_id: requestId
    });

    if (!rpcErr) {
      return { user: { id: rpcUserId, email: cleanEmail } };
    }

    console.warn('RPC admin_provisionar_usuario indisponível, tentando fallback signUp:', rpcErr.message);
    const tempClient = this._createIsolatedClient();
    const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
      options: { data: { nome: cleanNome, role: 'viewer' } }
    });
    if (signUpErr) throw signUpErr;

    const userId = signUpData?.user?.id;
    if (userId) {
      const { error: profErr } = await client
        .from('user_profiles')
        .upsert({
          id: userId,
          nome: cleanNome,
          email: cleanEmail,
          role: 'viewer',
          status: 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      if (profErr) throw profErr;
    }
    return signUpData;
  },

  async aprovarSolicitacaoCriarUsuario({ requestId, email, nome, password }) {
    const client = this._ensureClient();
    await this.criarUsuarioVisualizadorDireto({ nome, email, password, requestId });

    const session = await this.getSession();
    const reviewedBy = session?.user?.email || window.Cotador?.core?.ADMIN_MASTER_EMAIL || 'admin';

    const { error } = await client
      .from('access_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
      })
      .eq('id', requestId);

    if (error) throw error;
  },

  async alterarSenhaUsuario(novaSenha) {
    const client = this._ensureClient();
    const { data, error } = await client.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    return data;
  }
};