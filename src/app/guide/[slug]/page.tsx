import { GUIDE_ARTICLES } from '@/lib/guide-data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return GUIDE_ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = GUIDE_ARTICLES.find((a) => a.slug === slug);
  if (!article) return {};

  return {
    title: `${article.title} | BowlingManager 볼링 가이드`,
    description: article.description,
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = GUIDE_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  // Simple formatter for paragraphs & headers in article content
  const formattedContent = article.content.split('\n\n').map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={idx} className="text-2xl font-extrabold text-slate-900 mt-10 mb-4 pb-2 border-b border-slate-200">
          {trimmed.replace('## ', '')}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-xl font-bold text-blue-600 mt-8 mb-3">
          {trimmed.replace('### ', '')}
        </h3>
      );
    }
    if (trimmed.startsWith('---')) {
      return <hr key={idx} className="my-8 border-slate-200" />;
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote key={idx} className="my-6 p-4 bg-blue-50 border-l-4 border-blue-600 text-blue-900 rounded-r-lg font-medium text-sm leading-relaxed">
          {trimmed.replace('> ', '')}
        </blockquote>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('1. ')) {
      const items = trimmed.split('\n').map((item) => item.replace(/^[-*]|\d+\.\s*/, '').trim());
      return (
        <ul key={idx} className="my-4 space-y-2 list-disc list-inside text-slate-700 font-medium">
          {items.map((it, i) => (
            <li key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
          ))}
        </ul>
      );
    }

    return (
      <p key={idx} className="my-4 text-slate-700 leading-relaxed font-normal text-base md:text-lg" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Navigation Back Link */}
      <div className="mb-8">
        <Link
          href="/guide"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
        >
          &larr; 볼링 가이드 목록으로 돌아가기
        </Link>
      </div>

      {/* Article Header */}
      <header className="mb-10 pb-8 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-blue-100 text-blue-800 text-xs font-black px-3 py-1 rounded-full">
            {article.category}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {article.date} · {article.readTime}
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-6">
          {article.title}
        </h1>
        <div className="flex items-center justify-between text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span>작성자: <strong className="text-slate-800">{article.author}</strong></span>
          <span>검증된 볼링 전문 가이드</span>
        </div>
      </header>

      {/* Article Body */}
      <article className="prose prose-slate max-w-none mb-16">
        {formattedContent}
      </article>

      {/* Bottom Action Footer */}
      <div className="bg-slate-100 rounded-2xl p-8 border border-slate-200 text-center">
        <h3 className="text-xl font-bold text-slate-900 mb-2">도움이 되셨나요?</h3>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          BowlingManager와 함께 내 볼링 점수를 수치화하고 팀 동호회 활동을 즐겨보세요.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/guide"
            className="bg-white hover:bg-slate-50 text-slate-800 font-bold px-5 py-2.5 rounded-xl border border-slate-300 text-sm no-underline"
          >
            다른 가이드 읽기
          </Link>
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm no-underline"
          >
            기록 관리 시작하기
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper function to format **bold** and `code` inline text
function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-blue-600 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');
}
