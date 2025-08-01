#!/usr/bin/env tsx

import { logger } from '../../shared/logger';
import { ProductCategorizer } from './categorizer';

// Test the categorizer with sample data
function testCategorizer() {
  logger.info('🧪 Testing Product Categorizer');

  const categorizer = new ProductCategorizer();

  // Test cases
  const testCases = [
    // Direct mapping
    { externalCategory: '커피', name: '아메리카노' },
    { externalCategory: '차', name: '얼그레이' },
    { externalCategory: '컴포즈 콤보', name: '치킨버거 세트' },
    { externalCategory: '디저트', name: '초콜릿 케이크' },
    { externalCategory: '논커피 라떼', name: '초콜릿 라떼' },
    { externalCategory: 'MD상품', name: '스타벅스 텀블러' },
    { externalCategory: '아이스크림/디저트', name: '바닐라 아이스크림' },
    { externalCategory: '빽스치노', name: '딸기 빽스치노' },

    // New priority rules testing
    { externalCategory: undefined, name: '딸기 라떼' }, // Should be 그 외 (priority 1)
    { externalCategory: undefined, name: '망고 리프레셔' }, // Should be 그 외 (priority 1)
    { externalCategory: undefined, name: '바닐라 티 라떼' }, // Should be 차 (priority 2)
    { externalCategory: undefined, name: '얼그레이 티' }, // Should be 차 (priority 2)
    { externalCategory: undefined, name: '딸기 프라푸치노' }, // Should be 블렌디드 (priority 3)

    // Pattern matching
    { externalCategory: undefined, name: '아이스 아메리카노' },
    { externalCategory: undefined, name: '카푸치노 라떼' },
    { externalCategory: undefined, name: '망고 스무디' }, // Should be 스무디 (딸기 removed)
    { externalCategory: undefined, name: '자몽 에이드' },

    // Fallback
    { externalCategory: undefined, name: '알수없는 음료' },
  ];

  logger.info('\n📋 Test Results:');
  testCases.forEach((testCase, index) => {
    const result = categorizer.testCategorize(testCase);
    logger.info(
      `${index + 1}. "${testCase.name}" → ${result.category} (${result.confidence}, ${result.source})`
    );
  });

  // Show stats
  const stats = categorizer.getStats();
  logger.info('\n📊 Categorizer Stats:');
  logger.info(`Total: ${stats.totalCategorizations}`);
  logger.info(`Human learnings: ${stats.humanLearnings}`);
  logger.info(`Average confidence: ${stats.averageConfidence.toFixed(2)}`);

  logger.info('\n✅ Test completed successfully!');
}

testCategorizer();
