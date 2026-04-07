import { NextRequest, NextResponse } from 'next/server';
import { getFAQs, searchFAQs, getFAQsByCategory } from '@/lib/knowledge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');

    let faqs;
    if (query) {
      faqs = searchFAQs(query);
    } else if (category) {
      faqs = getFAQsByCategory(category);
    } else {
      faqs = getFAQs();
    }

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error('获取FAQ失败:', error);
    return NextResponse.json({ error: '获取FAQ失败' }, { status: 500 });
  }
}
