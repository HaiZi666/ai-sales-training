'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CUSTOMER_TYPE_CONFIG, CustomerType } from '@/types';

const CUSTOMER_TYPES: CustomerType[] = ['type_a', 'type_b', 'type_c'];

export default function NewPracticePage() {
  const router = useRouter();
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  const [customerScore, setCustomerScore] = useState<string>('');
  const [customerSubject, setCustomerSubject] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async () => {
    if (!customerType || !customerScore || !customerSubject) {
      alert('请填写所有字段');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salespersonId: 'demo_user',
          customerType,
          customerScore,
          customerSubject,
        }),
      });
      
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/practice/${data.sessionId}`);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      alert('创建会话失败');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">新建演练</h1>
        <p className="text-gray-600 mb-8">选择客户类型，开始AI陪练</p>

        {/* 客户类型选择 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">1. 选择客户类型</h2>
          <div className="grid gap-4">
            {CUSTOMER_TYPES.map(type => {
              const config = CUSTOMER_TYPE_CONFIG[type];
              const isSelected = customerType === type;
              return (
                <button
                  key={type}
                  onClick={() => setCustomerType(type)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-lg">{config.name}</div>
                  <div className="text-gray-600 text-sm mt-1">{config.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 客户成绩 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. 选择客户成绩</h2>
          <div className="grid grid-cols-3 gap-4">
            {['优秀', '中游', '较差'].map(score => (
              <button
                key={score}
                onClick={() => setCustomerScore(score)}
                className={`p-4 rounded-lg border-2 text-center font-medium transition-all ${
                  customerScore === score
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* 弱科选择 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">3. 选择弱科</h2>
          <div className="grid grid-cols-3 gap-4">
            {['数学', '英语', '物理', '化学', '语文', '其他'].map(subject => (
              <button
                key={subject}
                onClick={() => setCustomerSubject(subject)}
                className={`p-4 rounded-lg border-2 text-center font-medium transition-all ${
                  customerSubject === subject
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          disabled={!customerType || !customerScore || !customerSubject || isCreating}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            !customerType || !customerScore || !customerSubject
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCreating ? '创建中...' : '开始演练'}
        </button>
      </div>
    </div>
  );
}
