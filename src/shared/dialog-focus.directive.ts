import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';

@Directive({ selector: '[role="dialog"], [role="alertdialog"]' })
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous = document.activeElement as HTMLElement | null;
  @Output() dismissed = new EventEmitter<void>();
  private controls() {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ).filter(element => !element.closest('[hidden], [inert]'));
  }
  ngAfterViewInit() {
    queueMicrotask(() => this.controls()[0]?.focus());
  }
  ngOnDestroy() {
    this.previous?.focus();
  }
  @HostListener('keydown', ['$event'])
  handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissed.emit();
    }
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
