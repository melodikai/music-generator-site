import { Component, ErrorInfo, ReactNode } from 'react';
import Icon from '@/components/ui/icon';

type Props = { children: ReactNode };
type State = { failed: boolean };

class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] crash', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="grid min-h-screen w-full place-items-center bg-background p-6">
        <div className="max-w-sm text-center">
          <Icon name="CircleAlert" size={26} className="mx-auto text-foreground/50" />
          <p className="mt-4 text-[1.05em] text-foreground">Что-то пошло не так</p>
          <p className="mt-2 text-[0.9em] leading-relaxed text-muted-foreground">
            Страница не смогла отобразиться. Обновите её — данные останутся на месте.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
