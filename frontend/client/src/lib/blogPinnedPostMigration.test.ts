import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_blog_pinned_post.sql"), "utf8");

describe("migração de artigo fixado", () => {
  it("permite somente um artigo fixado e mantém a prioridade apenas em artigos publicados", () => {
    expect(migration).toContain("blog_posts_single_pinned_idx");
    expect(migration).toContain("where is_pinned");
    expect(migration).toContain("if new.status <> 'published'");
  });

  it("protege a ação de fixação pela mesma permissão de gestão do blog", () => {
    expect(migration).toContain("has_endoacolhe_permission('blog_manage')");
    expect(migration).toContain("only published posts can be pinned");
    expect(migration).toContain("revoke all on function public.set_endoacolhe_blog_post_pinned(uuid, boolean) from public, anon");
  });
});
