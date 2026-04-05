import styles from "./page.module.css";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Nav */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>Truly</span>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>
              Features
            </a>
            <a href="#about" className={styles.navLink}>
              About
            </a>
            <a href={`${APP_URL}/login`} className={styles.navLink}>
              Log in
            </a>
            <a href={`${APP_URL}/signup`} className={styles.signupBtn}>
              Sign up
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Your platform,
            <br />
            <span className={styles.heroAccent}>truly yours.</span>
          </h1>
          <p className={styles.heroSub}>
            A better way to connect, create, and grow. Built for people who want more from their
            tools.
          </p>
          <div className={styles.heroCtas}>
            <a href={`${APP_URL}/signup`} className={styles.ctaPrimary}>
              Get started — it&apos;s free
            </a>
            <a href="#features" className={styles.ctaSecondary}>
              Learn more
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={styles.features}>
          <h2 className={styles.sectionTitle}>Why Truly?</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Lightning fast</h3>
              <p>Built for speed from the ground up. No compromises.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔒</div>
              <h3>Private by default</h3>
              <p>Your data is yours. We don&apos;t sell it, ever.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🌍</div>
              <h3>Works everywhere</h3>
              <p>Web, iOS, and Android. One account, all your devices.</p>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className={styles.about}>
          <h2 className={styles.sectionTitle}>Built different.</h2>
          <p className={styles.aboutText}>
            We believe tools should work for you — not the other way around. Truly is built by a
            small, focused team that cares deeply about craft and user experience.
          </p>
        </section>

        {/* Bottom CTA */}
        <section className={styles.bottomCta}>
          <h2 className={styles.bottomCtaTitle}>Ready to get started?</h2>
          <a href={`${APP_URL}/signup`} className={styles.ctaPrimary}>
            Create your free account
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Truly. All rights reserved.</p>
      </footer>
    </div>
  );
}
