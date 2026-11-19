// 브라우저에 줄 ICE 서버 목록. TURN 키는 서버에만 두고, 클라이언트는 임시 자격 증명만 받는다.
// 환경 변수: METERED_DOMAIN (예: myapp.metered.live), METERED_API_KEY. 없으면 STUN만 준다.
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const domain = process.env.METERED_DOMAIN, key = process.env.METERED_API_KEY;
  let turn = [];
  if (domain && key) {
    try {
      const r = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(2000) });
      const list = r.ok ? await r.json() : null;
      if (Array.isArray(list)) turn = list;
    } catch (e) { /* TURN 없이 STUN만으로 진행 */ }
  }
  res.status(200).json({ iceServers: [...STUN, ...turn], relay: turn.length > 0 });
};
