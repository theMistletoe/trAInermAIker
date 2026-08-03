import { getChallengeContent, listChallengeContents } from '@server/content';
import { assessmentQuestionSchema } from '@shared/schemas';
import { describe, expect, it } from 'vitest';

describe('課題コンテンツ一覧 (listChallengeContents)', () => {
  it('課題を1件返し、そのidがaws-cdk-file-sharingである', () => {
    const challenges = listChallengeContents();
    expect(challenges).toHaveLength(1);
    expect(challenges[0]?.id).toBe('aws-cdk-file-sharing');
  });
});

describe('課題1 (aws-cdk-file-sharing) のコンテンツ', () => {
  const challenge = listChallengeContents()[0];
  if (!challenge) throw new Error('challenge1 が存在しない');

  it('全ての確認問答がassessmentQuestionSchemaを満たす', () => {
    for (const question of challenge.assessmentQuestions) {
      expect(() => assessmentQuestionSchema.parse(question)).not.toThrow();
    }
  });

  it('single_choiceの問いは4択、free_textの問いはchoicesがnullである', () => {
    for (const question of challenge.assessmentQuestions) {
      if (question.kind === 'single_choice') {
        expect(question.choices).toHaveLength(4);
      } else {
        expect(question.choices).toBeNull();
      }
    }
  });

  it('公開の問題文 (descriptionMd) に秘匿情報が含まれない', () => {
    expect(challenge.descriptionMd).not.toContain('評価観点');
    expect(challenge.descriptionMd).not.toContain('90日');
    expect(challenge.descriptionMd).not.toContain('暗号化');
  });

  it('秘匿仕様 (hiddenSpecMd) が要件の主要マーカーを含む', () => {
    expect(challenge.hiddenSpecMd).toContain('機能要件');
    expect(challenge.hiddenSpecMd).toContain('90日');
    expect(challenge.hiddenSpecMd).toContain('暗号化');
  });

  it('提出要領 (submissionGuideMd) は公開で、提出フォーマット情報を含む', () => {
    expect(challenge.submissionGuideMd).toContain('cdk synth');
    expect(challenge.submissionGuideMd).toContain('README');
    expect(challenge.submissionGuideMd).toContain('提出物');
  });

  it('提出フォーマット情報は秘匿仕様に含まれない（チャットで引き出せない情報で減点しない）', () => {
    expect(challenge.hiddenSpecMd).not.toContain('cdk synth');
    expect(challenge.hiddenSpecMd).not.toContain('提出物');
  });

  it('評価基準 (rubricMd) が評価に言及する', () => {
    expect(challenge.rubricMd).toContain('評価');
  });
});

describe('課題コンテンツの取得 (getChallengeContent)', () => {
  it('未知のidに対してnullを返す', () => {
    expect(getChallengeContent('unknown')).toBeNull();
  });

  it('aws-cdk-file-sharingに対して該当課題を返す', () => {
    const challenge = getChallengeContent('aws-cdk-file-sharing');
    expect(challenge).not.toBeNull();
    expect(challenge?.id).toBe('aws-cdk-file-sharing');
    expect(challenge?.title).toBe('小規模チーム向けファイル共有サービスを設計せよ');
  });
});
