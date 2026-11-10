import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "./icons";

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SelectProps<T extends string> {
  /** Accessible name for the combobox trigger. */
  readonly label: string;
  readonly options: readonly SelectOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  /** Shown on the trigger when `value` matches no option. */
  readonly placeholder?: string;
  /** Extra classes for the trigger (context sizing, e.g. pill/block variants). */
  readonly className?: string;
  /** Rendered on the trigger for test targeting; the menu gets `<testId>-menu`. */
  readonly testId?: string;
  readonly disabled?: boolean;
}

const MENU_MAX_HEIGHT = 280;

/**
 * Codex-style dropdown that replaces the native `<select>` whose popup is drawn
 * by Windows and cannot match the app's design. The trigger follows the ARIA
 * combobox pattern; the option list reuses the workspace-menu visual recipe.
 */
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  className,
  testId,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    top: number;
    minWidth: number;
    above: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeAheadRef = useRef({ buffer: "", at: 0 });
  const listboxId = useId();

  const currentValue = options.some((option) => option.value === value) ? value : undefined;
  const currentOption = options.find((option) => option.value === currentValue);
  const activeOption = open ? options[activeIndex] : undefined;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight =
      menuRef.current?.offsetHeight ?? Math.min(options.length * 36 + 12, MENU_MAX_HEIGHT);
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const openAbove = below < Math.min(menuHeight + 12, MENU_MAX_HEIGHT) && above > below;
    setMenuStyle({
      left: rect.left,
      top: openAbove ? rect.top - 6 : rect.bottom + 6,
      minWidth: rect.width,
      above: openAbove,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const handle = () => close(false);
    // Scroll/resize would leave a fixed-position menu stranded; close instead.
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, placeMenu, close]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, close]);

  // Keep the active option visible while arrowing through the list.
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    menuRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openMenu = useCallback(() => {
    if (options.length === 0) return;
    typeAheadRef.current = { buffer: "", at: 0 };
    const selectedIndex = options.findIndex((option) => option.value === currentValue);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [options, currentValue]);

  const commit = useCallback(
    (option: SelectOption<T>) => {
      onChange(option.value);
      close();
    },
    [onChange, close],
  );

  const moveActive = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      setActiveIndex((index) => {
        const base = index < 0 ? 0 : index;
        return (base + delta + options.length) % options.length;
      });
    },
    [options.length],
  );

  const typeAhead = useCallback(
    (key: string) => {
      const now = Date.now();
      const state = typeAheadRef.current;
      const buffer = now - state.at > 500 ? key : state.buffer + key;
      typeAheadRef.current = { buffer, at: now };
      const lower = buffer.toLowerCase();
      const matchIndex = options.findIndex(
        (option, index) =>
          index > (activeIndex ?? -1) && option.label.toLowerCase().startsWith(lower),
      );
      const fallbackIndex = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(lower),
      );
      const next = matchIndex >= 0 ? matchIndex : fallbackIndex;
      if (next >= 0) setActiveIndex(next);
    },
    [options, activeIndex],
  );

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(options.length > 0 ? 0 : -1);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeOption) commit(activeOption);
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1) {
          event.preventDefault();
          typeAhead(event.key);
        }
    }
  };

  // Swallow the click that opened the menu so it does not land on an option.
  const handleMenuPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const menu = useMemo(() => {
    if (!open || !menuStyle) return null;
    return createPortal(
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-label={label}
        data-testid={testId ? `${testId}-menu` : undefined}
        className={`select-menu${menuStyle.above ? " select-menu--above" : ""}`}
        style={{
          left: menuStyle.left,
          top: menuStyle.top,
          minWidth: menuStyle.minWidth,
        }}
        onPointerDown={handleMenuPointerDown}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="option"
            id={`${listboxId}-${option.value}`}
            data-index={index}
            data-value={option.value}
            aria-selected={option.value === currentValue}
            className={`select-menu__item${index === activeIndex ? " select-menu__item--active" : ""}`}
            onClick={() => commit(option)}
            onPointerMove={() => setActiveIndex(index)}
          >
            <span className="select-menu__item-label">{option.label}</span>
            {option.value === currentValue ? (
              <span className="select-menu__item-check">
                <CheckIcon />
              </span>
            ) : null}
          </button>
        ))}
      </div>,
      document.body,
    );
  }, [open, menuStyle, listboxId, label, testId, options, currentValue, activeIndex, commit]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeOption ? `${listboxId}-${activeOption.value}` : undefined
        }
        aria-label={label}
        data-testid={testId}
        data-value={currentValue ?? ""}
        disabled={disabled}
        className={`select__trigger${open ? " select__trigger--open" : ""}${className ? ` ${className}` : ""}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`select__value${currentOption ? "" : " select__value--placeholder"}`}>
          {currentOption ? currentOption.label : (placeholder ?? options[0]?.label ?? "")}
        </span>
        <ChevronDownIcon />
      </button>
      {menu}
    </>
  );
}
