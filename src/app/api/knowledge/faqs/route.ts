import { NextRequest, NextResponse } from 'next/server';
import { faqs, searchFAQs, getFAQsByScenario, getAllScenarios } from '@/lib/knowledge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const scenario = searchParams.get('scenario');

    let result;
    if (query) {
      result = searchFAQs(query);
    } else if (scenario) {
      result = getFAQsByScenario(scenario as any);
    } else {
      result = faqs;
    }

    return NextResponse.json({ 
      faqs: result,
      scenarios: getAllScenarios()
    });
  } catch (error) {
    console.error('获取FAQ失败:', error);
    return NextResponse.json({ error: '获取FAQ失败' }, { status: 500 });
  }
}
