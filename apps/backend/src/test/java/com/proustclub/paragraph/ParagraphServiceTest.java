package com.proustclub.paragraph;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.ErrorResponseException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParagraphServiceTest {

    @Mock
    ParagraphRepository repository;

    @InjectMocks
    ParagraphService service;

    @Test
    void getContextTrimsTheExtraRowAndReportsHasMoreBefore() {
        when(repository.findAnchor(10)).thenReturn(Optional.of(new ParagraphRepository.Anchor(1, 100)));
        // before=1 requested, repository returned 2 (nearest-first) -> one more exists beyond
        when(repository.findBefore(1, 100, 1)).thenReturn(List.of(
                new ParagraphRepository.Row(9, "neuf", 10),
                new ParagraphRepository.Row(8, "huit", 9)
        ));
        when(repository.findAfter(1, 100, 0)).thenReturn(List.of());

        var response = service.getContext(10, 1, 0);

        assertThat(response.before()).extracting(e -> e.paragraphId()).containsExactly(9);
        assertThat(response.hasMoreBefore()).isTrue();
        assertThat(response.after()).isEmpty();
        assertThat(response.hasMoreAfter()).isFalse();
    }

    @Test
    void getContextReversesBeforeIntoReadingOrderWhenNothingIsTrimmed() {
        when(repository.findAnchor(10)).thenReturn(Optional.of(new ParagraphRepository.Anchor(1, 100)));
        // before=2 requested, repository returned exactly 2 (nearest-first) -> nothing more
        when(repository.findBefore(1, 100, 2)).thenReturn(List.of(
                new ParagraphRepository.Row(9, "neuf", 10),
                new ParagraphRepository.Row(8, "huit", 9)
        ));
        when(repository.findAfter(1, 100, 0)).thenReturn(List.of());

        var response = service.getContext(10, 2, 0);

        // reading order: oldest first, so 8 (further away) comes before 9 (nearer the center)
        assertThat(response.before()).extracting(e -> e.paragraphId()).containsExactly(8, 9);
        assertThat(response.hasMoreBefore()).isFalse();
    }

    @Test
    void getContextLeavesAfterInReadingOrderAsIs() {
        when(repository.findAnchor(10)).thenReturn(Optional.of(new ParagraphRepository.Anchor(1, 100)));
        when(repository.findBefore(1, 100, 0)).thenReturn(List.of());
        when(repository.findAfter(1, 100, 1)).thenReturn(List.of(
                new ParagraphRepository.Row(11, "onze", 10),
                new ParagraphRepository.Row(12, "douze", 11)
        ));

        var response = service.getContext(10, 0, 1);

        assertThat(response.after()).extracting(e -> e.paragraphId()).containsExactly(11);
        assertThat(response.hasMoreAfter()).isTrue();
    }

    @Test
    void getContextThrowsNotFoundForAnUnknownParagraph() {
        when(repository.findAnchor(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getContext(999, 0, 0))
                .isInstanceOf(ErrorResponseException.class);
    }
}
