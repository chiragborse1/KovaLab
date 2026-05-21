import { type SelectItem, type SettingItem, SettingsList } from "@mariozechner/pi-tui";
import {
  filterableSelectListTheme,
  searchableSelectListTheme,
  settingsListTheme,
} from "../theme/theme.js";
import { FilterableSelectList, type FilterableSelectItem } from "./filterable-select-list.js";
import { SearchableSelectList } from "./searchable-select-list.js";

export function createSearchableSelectList(items: SelectItem[], maxVisible = 7) {
  return new SearchableSelectList(items, maxVisible, searchableSelectListTheme);
}

export function createFilterableSelectList(
  items: FilterableSelectItem[],
  maxVisible = 7,
  initialFilter = "",
) {
  return new FilterableSelectList(items, maxVisible, filterableSelectListTheme, initialFilter);
}

export function createSettingsList(
  items: SettingItem[],
  onChange: (id: string, value: string) => void,
  onCancel: () => void,
  maxVisible = 7,
) {
  return new SettingsList(items, maxVisible, settingsListTheme, onChange, onCancel);
}
