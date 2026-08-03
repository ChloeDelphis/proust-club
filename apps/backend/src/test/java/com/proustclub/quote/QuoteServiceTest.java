package com.proustclub.quote;

import com.proustclub.quote.dto.CreateQuoteSelectionRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuoteServiceTest {

    @Mock
    QuoteRepository quoteRepository;

    @Mock
    TagRepository tagRepository;

    @InjectMocks
    QuoteService service;

    private final UUID userId = UUID.randomUUID();

    @Test
    void createSavesQuoteWhenSelectedTextMatchesParagraph() {
        var request = new CreateQuoteSelectionRequest(1, 3, 12, "madeleine", List.of());
        when(quoteRepository.findParagraphText(1)).thenReturn(Optional.of("La madeleine est un symbole fort."));
        when(quoteRepository.insert(userId, 1, 3, 12, "madeleine")).thenReturn(42);
        when(quoteRepository.findByIdAndUserId(42, userId)).thenReturn(Optional.of(
                new QuoteSelection(42, userId, 1, 3, 12, "madeleine", Instant.now())));
        when(quoteRepository.tagsForQuoteIds(List.of(42))).thenReturn(Map.of());

        var response = service.create(userId, request);

        assertThat(response.id()).isEqualTo(42);
        assertThat(response.selectedText()).isEqualTo("madeleine");
        assertThat(response.tags()).isEmpty();
    }

    @Test
    void createRejectsMismatchedSelectedText() {
        var request = new CreateQuoteSelectionRequest(1, 3, 12, "wrong-text", List.of());
        when(quoteRepository.findParagraphText(1)).thenReturn(Optional.of("La madeleine est un symbole fort."));

        assertThatThrownBy(() -> service.create(userId, request))
                .isInstanceOf(ApiException.class);

        verify(quoteRepository, never()).insert(any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    void createRejectsOffsetsOutOfBounds() {
        var request = new CreateQuoteSelectionRequest(1, 0, 1000, "does not matter", List.of());
        when(quoteRepository.findParagraphText(1)).thenReturn(Optional.of("Short paragraph."));

        assertThatThrownBy(() -> service.create(userId, request))
                .isInstanceOf(ApiException.class);

        verify(quoteRepository, never()).insert(any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    void createRejectsUnknownParagraph() {
        var request = new CreateQuoteSelectionRequest(999, 0, 5, "hello", List.of());
        when(quoteRepository.findParagraphText(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(userId, request))
                .isInstanceOf(ApiException.class);

        verify(quoteRepository, never()).insert(any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    void removeTagThrowsWhenNoAssociationWasRemoved() {
        when(quoteRepository.removeTagForOwner(userId, 1, 99)).thenReturn(0);

        assertThatThrownBy(() -> service.removeTag(userId, 1, 99))
                .isInstanceOf(ApiException.class);
    }
}
