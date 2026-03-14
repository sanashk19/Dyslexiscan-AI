import { Link } from 'react-router-dom'

export default function Games() {
  return (
    <>
      <style>{`
        :root{--bg:#F7F8FA;--card:#fff;--txt:#0F172A;--mut:#64748B;--b:#E5E7EB;--p:#2F6FED;--t:#17B890}
        *{box-sizing:border-box}body{margin:0;font-family:Lexend,system-ui;background:var(--bg);color:var(--txt)}
        .top{position:sticky;top:0;background:rgba(255,255,255,.8);backdrop-filter:blur(10px);border-bottom:1px solid var(--b);padding:16px}
        .wrap{max-width:980px;margin:0 auto;padding:18px}
        .card{background:var(--card);border:1px solid var(--b);border-radius:18px;box-shadow:0 10px 25px rgba(17,24,39,.06);padding:18px;position:relative;overflow:hidden}
        .card:before{content:"";position:absolute;left:0;top:0;height:4px;width:100%;background:linear-gradient(90deg,var(--p),var(--t))}
        .btn{border:1px solid var(--b);background:#fff;border-radius:999px;padding:10px 14px;font-weight:600;cursor:pointer;text-decoration:none;color:inherit;display:inline-flex;align-items:center;justify-content:center}
        .mut{color:var(--mut);line-height:1.6;margin:6px 0 0}
        .big{font-size:44px}
        .logo{height:28px;width:auto;border-radius:6px;vertical-align:middle}
      `}</style>

      <div className="top">
        <div
          className="wrap"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: 0,
          }}
        >
          <div>
            <img
              className="logo"
              src="/logo.png"
              alt="DyslexiScan logo"
              style={{ marginRight: 8 }}
            />
            <strong>Game Module</strong>
            <div className="mut">Empty page — content will be added later.</div>
          </div>
          <Link className="btn" to="/">
            ⬅ Back
          </Link>
        </div>
      </div>

      <div className="wrap">
        <div className="card" style={{ textAlign: 'center', padding: '34px 18px' }}>
          <div className="big">🎮</div>
          <h2 style={{ margin: '10px 0 6px', fontSize: 20 }}>Coming Soon</h2>
          <p className="mut">Your teammate will upload games UI here.</p>
        </div>
      </div>
    </>
  )
}
