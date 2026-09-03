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
        var quoteId = UUID.randomUUID();
        var request = new CreateQuoteSelectionRequest(1, 3, 12, "madeleine", List.of());
        when(quoteRepository.findParagraphText(1)).thenReturn(Optional.of("La madeleine est un symbole fort."));
        when(quoteRepository.insert(userId, 1, 3, 12, "madeleine"))
                .thenReturn(new QuoteSelection(quoteId, 1, 3, 12, "madeleine", null, Instant.now()));
        when(quoteRepository.tagsForQuoteIds(List.of(quoteId))).thenReturn(Map.of());

        var response = service.create(userId, request);

        assertThat(response.id()).isEqualTo(quoteId);
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
    void getTimelineAttachesTagsAndPreservesRepositoryOrder() {
        var quoteId1 = UUID.randomUUID();
        var quoteId2 = UUID.randomUUID();
        var entries = List.of(
                new TimelineEntry(quoteId1, 10, 5, 1, "madeleine", null, Instant.now()),
                new TimelineEntry(quoteId2, 20, 150, 2, "Un", null, Instant.now())
        );
        var volumes = List.of(
                new VolumeRange(1, "Du Côté de Chez Swann", 1, 1, 103),
                new VolumeRange(2, "À l'Ombre des Jeunes Filles en Fleurs", 2, 104, 183)
        );
        when(quoteRepository.findTimelineByUserId(userId, null)).thenReturn(entries);
        when(quoteRepository.findVolumesWithPageRange()).thenReturn(volumes);
        when(quoteRepository.tagsForQuoteIds(List.of(quoteId1, quoteId2))).thenReturn(Map.of(quoteId1, List.of()));

        var response = service.getTimeline(userId, null);

        assertThat(response.volumes()).hasSize(2);
        assertThat(response.volumes().get(1).minPage()).isEqualTo(104);
        assertThat(response.quotes()).hasSize(2);
        assertThat(response.quotes().get(0).selectedText()).isEqualTo("madeleine");
        assertThat(response.quotes().get(0).pageNumber()).isEqualTo(5);
        assertThat(response.quotes().get(1).volumeId()).isEqualTo(2);
    }

    @Test
    void updateCommentTrimsBeforeStoring() {
        var quoteId = UUID.randomUUID();
        when(quoteRepository.updateCommentForOwner(userId, quoteId, "Un souvenir d'enfance."))
                .thenReturn(Optional.of(new QuoteSelection(quoteId, 10, 0, 5, "madeleine", "Un souvenir d'enfance.", Instant.now())));
        when(quoteRepository.tagsForQuoteIds(List.of(quoteId))).thenReturn(Map.of());

        var response = service.updateComment(userId, quoteId, "  Un souvenir d'enfance.  ");

        assertThat(response.comment()).isEqualTo("Un souvenir d'enfance.");
        verify(quoteRepository).updateCommentForOwner(userId, quoteId, "Un souvenir d'enfance.");
    }

    @Test
    void updateCommentNormalizesBlankToNull() {
        var quoteId = UUID.randomUUID();
        when(quoteRepository.updateCommentForOwner(userId, quoteId, null))
                .thenReturn(Optional.of(new QuoteSelection(quoteId, 10, 0, 5, "madeleine", null, Instant.now())));
        when(quoteRepository.tagsForQuoteIds(List.of(quoteId))).thenReturn(Map.of());

        var response = service.updateComment(userId, quoteId, "   ");

        assertThat(response.comment()).isNull();
        verify(quoteRepository).updateCommentForOwner(userId, quoteId, null);
    }

    @Test
    void updateCommentThrowsWhenQuoteNotOwned() {
        var quoteId = UUID.randomUUID();
        when(quoteRepository.updateCommentForOwner(userId, quoteId, "comment")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateComment(userId, quoteId, "comment"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void removeTagThrowsWhenNoAssociationWasRemoved() {
        var quoteId = UUID.randomUUID();
        var tagId = UUID.randomUUID();
        when(quoteRepository.removeTagForOwner(userId, quoteId, tagId)).thenReturn(0);

        assertThatThrownBy(() -> service.removeTag(userId, quoteId, tagId))
                .isInstanceOf(ApiException.class);
    }
}
