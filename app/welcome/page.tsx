export default function Welcome() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff",
        color: "#111827",
        fontFamily: "Arial,sans-serif",
        padding: "24px 6vw",
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/welcome" style={{ fontSize: 23, fontWeight: 700 }}>
          ◉ Odin
        </a>
        <a
          href="/signin-with-chatgpt?return_to=/"
          style={{
            background: "#111827",
            color: "white",
            padding: "9px 16px",
            borderRadius: 5,
            fontSize: 13,
          }}
        >
          Sign In
        </a>
      </nav>
      <section
        style={{
          maxWidth: 1000,
          margin: "90px auto 40px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(36px,5vw,64px)",
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Intelligent
          <br />
          <span style={{ color: "#c00074" }}>Camera Monitoring</span>
        </h1>
        <p
          style={{
            maxWidth: 660,
            margin: "24px auto",
            fontSize: 17,
            lineHeight: 1.8,
            color: "#6b7280",
          }}
        >
          Connect your cameras, understand the moments that matter, and turn
          observations into action with visual workflows.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            margin: "30px 0 55px",
          }}
        >
          <a
            href="/signin-with-chatgpt?return_to=/"
            style={{
              background: "#111827",
              color: "white",
              padding: "13px 23px",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            Get Started →
          </a>
          <a
            href="#demo-preview"
            style={{
              border: "1px solid #e5e7eb",
              padding: "13px 23px",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            ▷ Watch Demo
          </a>
        </div>
        <div
          id="demo-preview"
          style={{
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            padding: 15,
            borderRadius: 12,
            boxShadow: "0 15px 50px #11182715",
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 14,
            textAlign: "left",
          }}
        >
          <video
            src="/demo/mall.mp4"
            poster="/demo/mall.jpg"
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%", borderRadius: 7, background: "black" }}
          />
          <div
            style={{ padding: "15px", background: "white", borderRadius: 7 }}
          >
            <h3 style={{ fontSize: 16, marginBottom: 18 }}>〰 Video Events</h3>
            {[
              "A person enters the monitored area.",
              "A backpack is left unattended.",
              "A person approaches the backpack.",
            ].map((s, i) => (
              <div
                key={s}
                style={{
                  fontSize: 12,
                  padding: 12,
                  marginBottom: 8,
                  border: "1px solid " + (i ? "#fde68a" : "#a7f3d0"),
                  background: i ? "#fffbeb" : "#ecfdf5",
                  borderRadius: 4,
                }}
              >
                <small>00:{i * 10 + 3}</small>
                <p style={{ marginTop: 5 }}>{s}</p>
              </div>
            ))}
            <small style={{ fontSize: 10, color: "#9ca3af" }}>
              Recorded demonstration with scripted annotations.
            </small>
          </div>
        </div>
      </section>
    </main>
  );
}
