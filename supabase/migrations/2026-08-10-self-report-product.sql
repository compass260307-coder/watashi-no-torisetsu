-- ¥199「自己診断結果の解放 + 自己分析PDF」商品。
--
-- 権限は payment_history の completed 行から導出する。既存 plan='full' 購入者は
-- hasSelfReportAccess() で引き続き自己診断/PDFを利用できるため、users の変更は不要。

alter table public.payment_history
  drop constraint if exists payment_history_payment_kind_check;

alter table public.payment_history
  add constraint payment_history_payment_kind_check
  check (
    payment_kind in (
      'integrated_trisetsu',
      'perception_unlock',
      'full_access',
      'tako_unlock',
      'self_report'
    )
  )
  not valid;

alter table public.payment_history
  validate constraint payment_history_payment_kind_check;

create index if not exists idx_payment_history_self_report_user
  on public.payment_history (user_id, paid_at)
  where payment_kind = 'self_report' and status = 'completed';
