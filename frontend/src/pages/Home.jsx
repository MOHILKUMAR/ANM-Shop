import { Link } from "react-router-dom";
import { beautyCategories } from "../data/beautyCategories.js";

const features = [
  ["01", "Thoughtful essentials", "Everyday products for skin, makeup, hair, and body."],
  ["02", "Easy routines", "Find the pieces that make your daily ritual feel special."],
  ["03", "Made for your shelf", "Discover practical staples alongside little luxuries."],
  ["04", "A smoother checkout", "Shop your picks in a simple, secure flow."],
];

function Home() {
  return (
    <div className="bg-gray-50">
      <section className="anm-hero-gradient relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full border border-accent-300/20" />
        <div className="pointer-events-none absolute -right-8 -top-16 h-64 w-64 rounded-full border border-accent-300/20" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.28em] text-accent-300">Beauty, made personal</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight sm:text-7xl">
            Your daily ritual, <span className="font-serif italic text-accent-300">beautifully</span> considered.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
            Explore skincare, makeup, haircare, and body essentials chosen to make getting ready feel like time for you.
          </p>
          <Link to="/shop" className="mt-9 inline-flex items-center gap-3 rounded-full bg-accent-300 px-7 py-3.5 font-semibold text-brand-900 transition hover:bg-accent-100">
            Explore the collection <span aria-hidden="true">↗</span>
          </Link>
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-white/55">Skincare <span className="mx-2 text-accent-300">/</span> Makeup <span className="mx-2 text-accent-300">/</span> Hair and body</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Find your ritual</p>
            <h2 className="text-3xl font-semibold text-gray-900 sm:text-4xl">Shop by category</h2>
          </div>
          <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/shop">View all products <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {beautyCategories.map((category, index) => (
            <Link
              className={`group rounded-2xl border border-gray-200 p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg ${index === 0 || index === 5 ? "bg-brand-50" : "bg-white"}`}
              key={category.name}
              to={`/shop?category=${encodeURIComponent(category.name)}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100 font-serif text-xl text-brand-800" aria-hidden="true">{category.icon}</span>
              <h3 className="mt-5 text-lg font-semibold text-gray-900 group-hover:text-brand-700">{category.name}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">The ANM-Shop edit</p>
            <h2 className="text-3xl font-semibold text-gray-900 sm:text-4xl">A little care goes a long way.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([number, title, description]) => (
              <article className="rounded-2xl bg-gray-50 p-6" key={number}>
                <p className="font-serif text-2xl italic text-brand-600">{number}</p>
                <h3 className="mt-5 font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-accent-50 px-4 py-16 text-center sm:px-6 lg:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Find your next favorite</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold text-gray-900 sm:text-4xl">Good skin days and great makeup days start here.</h2>
        <Link to="/shop" className="mt-7 inline-flex rounded-full bg-brand-700 px-7 py-3.5 font-semibold text-white transition hover:bg-brand-800">Shop ANM-Shop</Link>
      </section>
    </div>
  );
}

export default Home;
