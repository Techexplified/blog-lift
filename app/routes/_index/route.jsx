import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  // #region agent log
  fetch("http://127.0.0.1:7697/ingest/a18a9cec-7dcc-4b42-a60d-5572eee3fb6a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "7041f3",
    },
    body: JSON.stringify({
      sessionId: "7041f3",
      location: "_index/route.jsx:loader",
      message: "index loader",
      data: {
        pathname: url.pathname,
        hasShopParam: Boolean(url.searchParams.get("shop")),
        hasLoginExport: Boolean(login),
      },
      timestamp: Date.now(),
      hypothesisId: "H4",
      runId: "pre-fix",
    }),
  }).catch(() => {});
  // #endregion

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-300">
      <div className={`${styles.index} bg-white dark:bg-slate-900 shadow-xl dark:shadow-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800`}>
        <div className={styles.content}>
          <h1 className={`${styles.heading} dark:text-white`}>A short heading about BlogLift</h1>
          <p className={`${styles.text} dark:text-slate-400`}>
            A tagline about BlogLift that describes your value proposition.
          </p>
          {showForm && (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={`${styles.label} dark:text-slate-300`}>
                <span>Shop domain</span>
                <input className={`${styles.input} dark:bg-slate-800 dark:border-slate-700 dark:text-white`} type="text" name="shop" />
                <span className="dark:text-slate-500">e.g: my-shop-domain.myshopify.com</span>
              </label>
              <button className={styles.button} type="submit">
                Log in
              </button>
            </Form>
          )}
          <ul className={`${styles.list} dark:text-slate-400`}>
            <li>
              <strong className="dark:text-slate-200">AI-Powered Content</strong>. Generate high-quality SEO blog posts in seconds.
            </li>
            <li>
              <strong className="dark:text-slate-200">SEO Optimized</strong>. Ensure your content ranks well on search engines.
            </li>
            <li>
              <strong className="dark:text-slate-200">Direct Shopify Integration</strong>. Publish your blogs directly to your store with one click.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
