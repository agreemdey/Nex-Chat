require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  const { data: convs, error: convErr } = await supabase.from('conversations').select('*');
  const { data: members, error: memErr } = await supabase.from('conversation_members').select('*');
  const { data: msgs, error: msgErr } = await supabase.from('messages').select('*');

  console.log('convs', JSON.stringify(convs, null, 2));
  console.log('members', JSON.stringify(members, null, 2));
  console.log('msgs', JSON.stringify(msgs, null, 2));
  console.log('convErr', convErr && convErr.message);
  console.log('memErr', memErr && memErr.message);
  console.log('msgErr', msgErr && msgErr.message);
})();
