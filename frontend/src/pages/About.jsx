import { Link } from "react-router-dom";

function About() {
  return (
    <main className="bg-gray-50">
      <section className="anm-hero-gradient text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-300">Our story</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold sm:text-6xl">Beauty for your everyday rituals.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/80">ANM-Shop brings skincare, makeup, haircare, body care, and beauty tools together in one thoughtful place.</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">What we believe</p>
            <h2 className="mt-3 text-3xl font-semibold text-gray-900">Your routine should feel like your own.</h2>
          </div>
          <div className="space-y-5 leading-7 text-gray-600">
            <p>Good beauty is personal. It can be a gentle cleanser before a busy day, a favorite lipstick, or a little extra care for your hair and skin.</p>
            <p>We are building ANM-Shop as an easy place to discover practical beauty essentials and small everyday luxuries across skincare, makeup, hair, body, and accessories.</p>
            <p>Our aim is simple: make it easier to find products that fit your routine, explore something new, and enjoy the moments you set aside for yourself.</p>
          </div>
        </div>
        <div className="mt-12 rounded-3xl bg-accent-50 p-8 text-center sm:p-12">
          <p className="font-serif text-3xl text-brand-800">Make room for your ritual.</p>
          <Link className="mt-6 inline-flex rounded-full bg-brand-700 px-7 py-3 font-semibold text-white hover:bg-brand-800" to="/shop">Explore the beauty edit</Link>
        </div>
      </section>
    </main>
  );
}

export default About;
