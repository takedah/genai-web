import {
  NotificationBanner,
  NotificationBannerBody,
} from '@/components/ui/dads/NotificationBanner';
import { Ol } from '@/components/ui/dads/Ol';
import { Ul } from '@/components/ui/dads/Ul';

export const ChatNotificationBanner = () => {
  return (
    <>
      <NotificationBanner
        bannerStyle='standard'
        type='info1'
        title='チャット入力のEnterキー仕様変更のお知らせ'
        headingLevel='h2'
        className='mb-4 max-w-[calc(1024/16*1rem)]'
      >
        <NotificationBannerBody>
          <div className='flex flex-col gap-4'>
            <p>
              これまで <kbd>Enter</kbd>{' '}
              キーで内容が送信されていましたが、誤送信防止のため仕様を変更しました。
              <br />
              現在は <kbd>Enter</kbd> キーを押下すると改行され、Windowsでは <kbd>Ctrl</kbd> +{' '}
              <kbd>Enter</kbd>、Macでは <kbd>Command</kbd> + <kbd>Enter</kbd> で内容が送信されます。
            </p>
          </div>
        </NotificationBannerBody>
      </NotificationBanner>
      <NotificationBanner
        bannerStyle='standard'
        type='warning'
        title='生成AI利用時の注意事項'
        headingLevel='h2'
        className='max-w-[calc(1024/16*1rem)]'
      >
        <NotificationBannerBody>
          <div className='flex flex-col gap-4'>
            <p>本アプリは生成AIを使用しています。以下のリスクと対応をご理解ください：</p>
            <dl className='flex flex-col gap-4'>
              <div>
                <dt className='mb-2 font-700'>リスクの例：</dt>
                <dd>
                  <Ul>
                    <li>ハルシネーション（でたらめ）：事実と異なる不正確な情報を生成するおそれ</li>
                    <li>最新性の欠如：古い情報に基づく回答を生成するおそれ</li>
                    <li>バイアス：偏った見解や政府の公式見解と異なる判断を生成するおそれ</li>
                    <li>著作権侵害：保護された著作物を不適切に生成するおそれ</li>
                    <li>倫理的問題：道徳的に問題のある判断や提案を生成するおそれ</li>
                    <li>
                      再現性や説明可能性の欠如：同じ質問でも異なる回答を生成し、生成された内容の根拠も不明なおそれ
                    </li>
                  </Ul>
                </dd>
              </div>
              <div>
                <dt className='mb-2 font-700'>対応アクション：</dt>
                <dd>
                  <Ol>
                    <li>
                      常に出力内容を批判的に評価し、利用者自身で正確性・妥当性等を判断してください
                    </li>
                    <li>機密性３情報や業務目的以外の私的利用の情報の入力は避けてください</li>
                    <li>必ず他の信頼できる情報源を確認してください</li>
                  </Ol>
                </dd>
              </div>
              <div>
                <dt className='mb-2 font-700'>
                  チャットでのやり取りが長大になると、以下のような問題が発生します：
                </dt>
                <dd>
                  <Ul>
                    <li>生成AIが過去の会話内容を参照しにくくなる</li>
                    <li>生成AIの出力まで時間がかかるようになる</li>
                    <li>生成AIの利用料金が上がる（最大でチャット1回で3ドル程になります）</li>
                    <li>
                      一定以上（入力文と出力文の合計がおおよそ数十万文字ほどが目安）になるとエラーになり会話が続けられなくなる
                    </li>
                  </Ul>
                  <p className='mt-2'>
                    特にファイル添付を活用した場合、想定以上に生成AIへの入力文が多くなる傾向があります
                  </p>
                  <p className='mt-2'>
                    ある程度会話が続いたら、「ここまでの会話を要約して」と生成AIに依頼し、その要約文をもとに新しい会話を開始すると、この問題を回避できます。
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </NotificationBannerBody>
      </NotificationBanner>
    </>
  );
};
