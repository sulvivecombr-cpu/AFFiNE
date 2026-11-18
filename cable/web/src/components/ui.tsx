import type { ReactNode } from 'react';
import { IconAlert, IconCheck } from './Icons';
import type { Indicator } from '../types';

export function Stat({ indicator }: { indicator: Indicator }) {
  return (
    <div className={`card stat ${indicator.insufficient ? 'stat-empty' : ''}`}>
      <span className="stat-label">{indicator.label}</span>
      <span className="stat-value">
        {indicator.insufficient || indicator.value === null ? (
          <span>Sem dados</span>
        ) : (
          <>
            {indicator.value}
            {indicator.unit ? <span className="stat-unit">{indicator.unit}</span> : null}
          </>
        )}
      </span>
      <span className="stat-detail">{indicator.detail}</span>
      <span className="stat-rule">{indicator.rule}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <IconAlert size={20} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}

export function Banner({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'error' | 'warn' | 'success';
  children: ReactNode;
}) {
  return <div className={`banner banner-${kind}`}>{children}</div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="toast" role="status" onAnimationEnd={() => setTimeout(onDone, 2600)}>
      <IconCheck size={15} />
      {message}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card card-pad col" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ height: index === 0 ? 22 : 14, width: index === 0 ? '42%' : `${88 - index * 9}%` }}
        />
      ))}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return <Banner kind="error">{message}</Banner>;
}
