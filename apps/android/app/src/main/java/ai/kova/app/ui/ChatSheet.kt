package ai.kova.app.ui

import androidx.compose.runtime.Composable
import ai.kova.app.MainViewModel
import ai.kova.app.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
